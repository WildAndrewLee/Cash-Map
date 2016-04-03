$(function(){
    var TRANSACTION_DURATION = 50; // in frames
    var COLORS = [
        '#E03232',
        '#FF11EE',
        '#33CC66',
        '#669EFF',
        '#D061AD',
        '#997755'
    ];

    /*
     * Basic Transfer function that keeps track of Polyline
     * coordinates over TRANSACTION_DURATION number of frames.
     */
    var Transfer = function(start, end, merchant_id){
        this.start = start;
        this.current = {lat: start.lat, lng: start.lng};
        this.end = end;
        this.frame = 0;

        this._xIncrement = (this.end.lat - this.start.lat) / TRANSACTION_DURATION;
        this._yIncrement = (this.end.lng - this.start.lng) / TRANSACTION_DURATION;

        this.merchant_id = merchant_id;
    };

    /*
     * Increment function that signals a frame advance.
     * Returns true if the Transaction is done being drawn.
     * Returns false otherwise.
     */
    Transfer.prototype.increment = function(){
        if(this.frame === TRANSACTION_DURATION){
            this.current = this.end;
            return true;
        }
        else{
            this.frame++;
            this.current.lat += this._xIncrement;
            this.current.lng += this._yIncrement;
            return false;
        }
    };

    /*
     * Generate a human date string.
     */
    var format_date = function(date){
        var parts = date.split('-');
        var year = parts[0];
        var month = parts[1];
        var day = parts[2];

        var months = [
            'January',
            'February',
            'March',
            'April',
            'May',
            'June',
            'July',
            'August',
            'Septemer',
            'October',
            'November',
            'December'
        ];

        return months[parseInt(month)] + ' ' + day + ', ' + year;
    };

    $('#process-customer').click(function(){
        /*
         * Runtime variables.
         */
        var transfers = {};
        var locations = {};
        var merchants = {};
        var dates = [];
        var payer_loc = null;

        var customer_id = $('#customer').val();

        get_location(customer_id).then(function(payer){
           payer_loc = payer;
           return get_accounts(customer_id);
        }).then(function(accounts){
            var promise = $.Deferred();
            var all_done = [];

            for(var x = 0; x < accounts.length; x++){
                var id = accounts[x]._id;
                var new_promise = $.Deferred();

                (function(new_promise, id, new_promise){
                    get_purchases(id).then(function(purchases){
                        new_promise.resolve(purchases);
                    });
                })(new_promise, id, new_promise);

                all_done.push(new_promise);
            }

            $.when.apply(null, all_done).then(function(){
                var data = [];

                for(var x = 0; x < arguments.length; x++)
                    $.merge(data, arguments[x]);

                promise.resolve(data);
            });

            return promise;
        }).then(function(data){
            /*
             * Restructure all data so that purchases are grouped in subarrays
             * by date.
             */
            var structured_data = [];

            for(var x = 0; x < data.length; x++){
                var last_batch = structured_data[structured_data.length - 1];

                if(!last_batch || last_batch[0].purchase_date !== data[x].purchase_date){
                    structured_data.push([data[x]]);
                }
                else{
                    last_batch.push(data[x]);
                }
            }

            $('#dates').empty();

            for(var x = 0; x < structured_data.length; x++){
                var date = structured_data[x][0].purchase_date;
                var formatted_date = format_date(date);

                $('<aside>').attr('id', date)
                    .addClass('purchase-date')
                    .text(formatted_date)
                    .appendTo('#dates');

                dates.push(date);
            }

            var promise = $.Deferred();

            var load_single = function(data){
                // Only process executed requests.
                if(data.status !== 'executed')
                    return;

                var promise = $.Deferred();

                var add_transfer = function(){
                    if(!transfers.hasOwnProperty(data.purchase_date)){
                        transfers[data.purchase_date] = [
                            new Transfer(payer_loc, locations[data.merchant_id], data.merchant_id)
                        ];
                    }
                    else{
                        transfers[data.purchase_date].push(new Transfer(payer_loc, locations[data.merchant_id], data.merchant_id));
                    }
                };

                if(!locations.hasOwnProperty(data.merchant_id)){
                    get_merchant(data.merchant_id).then(function(merchant){
                        locations[data.merchant_id] = merchant.geocode;
                        merchants[data.merchant_id] = merchant;
                        merchants[data.merchant_id].amount = data.amount;
                        merchants[data.merchant_id].visits = 0;
                        add_transfer();
                        promise.resolve();
                    });
                }
                else{
                    merchants[data.merchant_id].amount += data.amount;
                    add_transfer();
                    promise.resolve();
                }

                return promise;
            };

            var all_done = [];
            var loader = null;

            var load_data = function(){
                if(data.length){
                    all_done.push(load_single(data.shift()));
                }
                else{
                    window.clearInterval(loader);
                    $.when.apply(null, all_done).done(function(){
                        promise.resolve(payer_loc);
                    });
                }
            };

            loader = window.setInterval(load_data, 100);

            return promise;
        }).then(function(payer){
            var ele = $('#map').get(0);

            var bounds = new google.maps.LatLngBounds();
            bounds.extend(new google.maps.LatLng(payer.lat, payer.lng));

            for(var x = 0; x < dates.length; x++){
                var for_date = transfers[dates[x]];

                for(var y = 0; y < for_date.length; y++){
                    var lat = for_date[y].end.lat;
                    var lng = for_date[y].end.lng;

                    bounds.extend(new google.maps.LatLng(lat, lng));
                }
            }

            var map = new google.maps.Map(ele, {
                center: payer
            });

            map.fitBounds(bounds);

            var color_index = 0;

            function render(){
                if(!dates.length)
                    return;

                var day = transfers[dates[0]];
                var done = false;

                for(var x = 0; x < day.length; x++){
                    var transfer = day[x];

                    var path = new google.maps.Polyline({
                        path: [transfer.start, transfer.current],
                        strokeColor: COLORS[color_index % COLORS.length],
                        strokeOpacity: 0.8,
                        strokeWeight: 1
                    });

                    path.setMap(map);

                    $('.selected').removeClass('selected');
                    $('#' + dates[0]).addClass('selected');

                    if(transfer.increment()){
                        done = true;

                        if(merchants[transfer.merchant_id].circle)
                            merchants[transfer.merchant_id].circle.setMap(null);

                        merchants[transfer.merchant_id].visits++;

                        var circle = new google.maps.Circle({
                              strokeColor: '#FF0000',
                              strokeOpacity: 0.8,
                              strokeWeight: 2,
                              fillColor: '#FF0000',
                              fillOpacity: 0.25,
                              center: transfer.end,
                              radius: merchants[transfer.merchant_id].visits * 10
                        });

                        (function(circle, transfer){
                            circle.addListener('click', function(){
                                var info = new google.maps.InfoWindow();
                                info.setContent('<b>' + merchants[transfer.merchant_id].name + '</b><br /><b>Total Visits: </b>' + merchants[transfer.merchant_id].visits + '<br /><b>Amount Spent: </b>$' + merchants[transfer.merchant_id].amount);
                                info.setPosition(circle.getCenter());
                                info.open(map);
                            });

                        })(circle, transfer);

                        circle.setMap(map);

                        merchants[transfer.merchant_id].circle = circle;
                    }
                }

                if(done){
                    dates.shift();
                    color_index++;
                }

                window.requestAnimationFrame(render);
            }

            var listener = map.addListener('tilesloaded', function(){
                setTimeout(function(){
                    window.requestAnimationFrame(render);
                }, 500);

                listener.remove();
            });
        });
    });
});

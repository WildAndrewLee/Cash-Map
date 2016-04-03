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

    var payer_loc = null;

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

    /*
     * Fetch purchases
     */
    var get_all_purchases = function(accounts, date){
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

            if(typeof date !== 'undefined')
                data = data.filter(function(purchase){
                    return purchase.purchase_date === date;
                });

            promise.resolve(data);
        });

        return promise;
    };

    /*
     * Generate date tabs.
     */
    var create_dates = function(data){
        var dates = {};
        $('#dates').empty();

        data.forEach(function(purchase){
            var date = purchase.purchase_date;

            if(dates.hasOwnProperty(date))
                return;

            var formatted_date = format_date(date);

            $('<aside>').attr('id', date)
                .addClass('purchase-date')
                .text(formatted_date)
                .click(function(){
                    do_the_thing($(this).attr('id'));
                })
                .appendTo('#dates');

            dates[date] = 0;
        });
    };

    /*
     * Generate data to draw.
     */
    var gen_draw_data = function(data){
        var transfers = {};
        var merchants = {};

        /*
         * Basic Transfer class that keeps track of Polyline
         * coordinates over TRANSACTION_DURATION number of frames.
         */
        var Transfer = function(start, end){
            this.start = start;
            this.current = {lat: start.lat, lng: start.lng};
            this.end = end;
            this.frame = 0;

            this._xIncrement = (this.end.lat - this.start.lat) / TRANSACTION_DURATION;
            this._yIncrement = (this.end.lng - this.start.lng) / TRANSACTION_DURATION;
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
         * Basic purchase class to keep track
         * of purchases.
         */
        var Purchase = function(merchant_id, amount){
            Transfer.call(this, payer_loc, merchants[merchant_id].geocode);
            this.merchant_id = merchant_id,
            this.amount = amount;
        };

        Purchase.prototype = Object.create(Transfer.prototype);

        var promise = $.Deferred();

        var load_single = function(data){
            // Only process executed requests.
            if(data.status !== 'executed')
                return;

            var promise = $.Deferred();

            var add_transfer = function(){
                if(!transfers.hasOwnProperty(data.purchase_date)){
                    transfers[data.purchase_date] = [
                        new Purchase(data.merchant_id, data.amount)
                    ];
                }
                else{
                    transfers[data.purchase_date].push(
                        new Purchase(data.merchant_id, data.amount)
                    );
                }
            };

            if(!merchants.hasOwnProperty(data.merchant_id)){
                get_merchant(data.merchant_id).then(function(merchant){
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
                    promise.resolve(payer_loc, merchants, transfers);
                });
            }
        };

        loader = window.setInterval(load_data, 100);

        return promise;
    };

    /*
     * Draw transfer data.
     */
    var draw_data = function(payer, merchants, transfers){
        var ele = $('#map').get(0);

        var bounds = new google.maps.LatLngBounds();
        bounds.extend(new google.maps.LatLng(payer.lat, payer.lng));

        Object.getOwnPropertyNames(transfers).forEach(function(date){
            transfers[date].forEach(function(transfer){
                var lat = transfer.end.lat;
                var lng = transfer.end.lng;

                bounds.extend(new google.maps.LatLng(lat, lng));
            });
        });

        var map = new google.maps.Map(ele, {
            center: payer
        });

        map.fitBounds(bounds);

        var dates = Object.getOwnPropertyNames(transfers);
        dates.sort(function(a, b){
            return new Date(a) - new Date(b);
        });

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

            $('#loading').css('display', 'none');

            listener.remove();
        });
    }

    var do_the_thing = function(date){
        /*
         * Runtime variables.
         */
        var customer_id = $('#customer').val();

        $('#loading').css('display', 'flex');

        get_location(customer_id).then(function(payer){
           payer_loc = payer;
           return get_accounts(customer_id);
        }).then(function(accounts){
            return get_all_purchases(accounts, date);
        }).then(function(data){
            if(typeof date === 'undefined'){
                create_dates(data);
            }

            var promise = $.Deferred();
            promise.resolve.apply(promise, arguments);

            return promise;
        }).then(gen_draw_data).then(draw_data);
    };

    $('#process-customer').click(function(){
        do_the_thing();
    });
});

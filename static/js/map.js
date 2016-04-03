$(function(){
    var TRANSACTION_DURATION = 50; // in frames

    if(location.href.match(/\?dev/))
        TRANSACTION_DURATION = 1;

    var COLORS = [
        '#E03232',
        '#FF11EE',
        '#33CC66',
        '#669EFF',
        '#D061AD',
        '#997755'
    ];

    var customer_id_old = null;
    var customer_loc = null;
    var customer_accounts = null;

    var current_view = null;

    var fetched_data = {
        merchants: null,
        payer: null,
        transfers: null
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

        return months[parseInt(month) - 1] + ' ' + day + ', ' + year;
    };

    /*
     * Fetch purchases
     */
    var get_all_purchases = function(accounts, filter){
        var promise = $.Deferred();
        var all_done = [];

        for(var x = 0; x < accounts.length; x++){
            var id = accounts[x]._id;

            var new_promise = $.Deferred();

            (function(new_promise, id){
                get_purchases(id).then(function(purchases){
                    new_promise.resolve(purchases);
                });
            })(new_promise, id);

            all_done.push(new_promise);
        }

        $.when.apply(null, all_done).then(function(){
            var data = [];

            for(var x = 0; x < arguments.length; x++)
                $.merge(data, arguments[x]);

            if(typeof filter === 'function')
                data = data.filter(filter);

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

        data.sort(function(a, b){
            return new Date(a.purchase_date) - new Date(b.purchase_date);
        });

        data.forEach(function(purchase){
            var date = purchase.purchase_date;

            if(dates.hasOwnProperty(date))
                return;

            var formatted_date = format_date(date);

            $('<aside>').attr('id', date)
                .addClass('purchase-date')
                .text(formatted_date)
                .click(function(){
                    $('.selected').removeClass('selected');
                    $('#' + dates[0]).addClass('selected');

                    current_view = date;
                    draw_view(date);
                })
                .appendTo('#dates');

            dates[date] = 0;
        });

        var promise = $.Deferred();
        promise.resolve(data);
        return promise;
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
        var Purchase = function(account_id, merchant_id, amount){
            Transfer.call(this, customer_loc, merchants[merchant_id].geocode);
            this.account_id = account_id;
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
                        new Purchase(data.payer_id, data.merchant_id, data.amount)
                    ];
                }
                else{
                    transfers[data.purchase_date].push(
                        new Purchase(data.payer_id, data.merchant_id, data.amount)
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
                    promise.resolve(customer_loc, merchants, transfers);
                });
            }
        };

        loader = window.setInterval(load_data, 100);

        return promise;
    };

    /*
     * Cache data.
     */
    var cache_data = function(payer, merchants, transfers){
        fetched_data.payer = payer;
        fetched_data.merchants = merchants;
        fetched_data.transfers = transfers;

        var promise = $.Deferred();
        promise.resolve(payer, merchants, transfers);

        return promise;
    };

    /*
     * Draw transfer data.
     */
    var draw_data = function(payer, merchants, transfers){
        $('#account').attr('disabled', true);

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

        var d = Math.max(Math.abs(bounds.R.R - bounds.R.j), Math.abs(bounds.j.R - bounds.j.j)) / 80;
        var coords = [
            {lat: payer.lat + d, lng: payer.lng},
            {lat: payer.lat,     lng: payer.lng - d * 1.5},
            {lat: payer.lat,     lng: payer.lng - d},
            {lat: payer.lat - d * 0.8, lng: payer.lng - d},
            {lat: payer.lat - d * 0.8, lng: payer.lng},
            {lat: payer.lat - d * 0.8, lng: payer.lng + d},
            {lat: payer.lat,     lng: payer.lng + d},
            {lat: payer.lat,     lng: payer.lng + d * 1.5}
        ];

        var home = new google.maps.Polygon({
            paths: coords,
            strokeColor: '#000000',
            strokeOpacity: 0.9,
            strokeWeight: 1,
            fillColor: '#000000',
            fillOpacity: 0.35
        });

        home.setMap(map);

        var dates = Object.getOwnPropertyNames(transfers);
        dates.sort(function(a, b){
            return new Date(a) - new Date(b);
        });

        var color_index = 0;
        var merchants_copy = $.extend(true, {}, merchants);
        var selected_account = $('#account').val();

        function render(){
            if(!dates.length){
                $('#account').removeAttr('disabled');
                return;
            }

            var day = transfers[dates[0]];
            var done = false;

            day = day.filter(function(transfer){
                return selected_account == '0' || transfer.account_id === selected_account;
            });

            if(!day.length){
                dates.shift();
                window.requestAnimationFrame(render);
                return;
            }

            for(var x = 0; x < day.length; x++){
                var transfer = day[x];

                var path = new google.maps.Polyline({
                    path: [transfer.start, transfer.current],
                    strokeColor: COLORS[color_index % COLORS.length],
                    strokeOpacity: 0.8,
                    strokeWeight: 1
                });

                path.setMap(map);

                if(transfer.increment()){
                    done = true;

                    if(merchants_copy[transfer.merchant_id].circle)
                        merchants_copy[transfer.merchant_id].circle.setMap(null);

                    merchants_copy[transfer.merchant_id].visits++;

                    var circle = new google.maps.Circle({
                          strokeColor: '#FF0000',
                          strokeOpacity: 0.8,
                          strokeWeight: 2,
                          fillColor: '#FF0000',
                          fillOpacity: 0.25,
                          center: transfer.end,
                          radius: merchants_copy[transfer.merchant_id].visits * 20
                    });

                    (function(circle, transfer){
                        circle.addListener('click', function(){
                            var info = new google.maps.InfoWindow();
                            info.setContent('<b>' + merchants_copy[transfer.merchant_id].name + '</b><br /><b>Total Visits: </b>' + merchants_copy[transfer.merchant_id].visits + '<br /><b>Amount Spent: </b>$' + merchants_copy[transfer.merchant_id].amount);
                            info.setPosition(circle.getCenter());
                            info.open(map);
                        });
                    })(circle, transfer);

                    circle.setMap(map);

                    merchants_copy[transfer.merchant_id].circle = circle;
                }
            }

            if(done){
                dates.shift();
                color_index++;
            }

            window.requestAnimationFrame(render);
        }

        var listener = map.addListener('tilesloaded', function(){
            window.requestAnimationFrame(render);

            $('#loading').css('display', 'none');

            listener.remove();
        });
    }

    var draw_view = function(view){
        $('#loading').css('display', 'flex');

        if(typeof view === 'undefined' || view === 'all'){
            draw_data(fetched_data.payer, fetched_data.merchants, fetched_data.transfers);
        }
        else{
            var obj = {};
            obj[view] = fetched_data.transfers[view];

            draw_data(fetched_data.payer, fetched_data.merchants, obj);
        }
    };

    var do_the_thing = function(){
        var customer_id = $('#customer').val();

        $('#does-not-exist').hide();

        if(customer_id === customer_id_old){
            draw_view();
            return;
        }

        $('#account').empty().append(
            $('<option>').text('All Accounts').val(0)
        ).attr('disabled', true);

        customer_id_old = customer_id;
        customer_accounts = null;
        customer_loc = null;
        fetched_data = {
            merchants: null,
            payer: null,
            transfers: null
        };

        $('#dates').empty();

        $('#loading').css('display', 'flex');

        get_location(customer_id).then(function(payer){
            customer_loc = payer;
            return get_accounts(customer_id);
        }).then(function(accounts){
            customer_accounts = accounts;

            accounts.forEach(function(account){
                $('#account').append(
                    $('<option>').text(account.nickname).val(account._id)
                );
            });

            return get_all_purchases(accounts);
        })
        .then(create_dates)
        .then(gen_draw_data)
        .then(cache_data)
        .then(draw_data);
    };

    $('#account').change(function(){
        draw_view(current_view);
    });

    $('#process-customer').click(function(){
        do_the_thing();
        current_view = 'all';
    });
});

var data = [
    {
      "_id": "56c8f36c061b2d440baf43f0",
      "amount": 5,
      "description": "Hey",
      "medium": "balance",
      "payee_id": "56c66be6a73e492741507c4d",
      "payer_id": "56c66be6a73e492741507c4c",
      "status": "executed",
      "transaction_date": "2016-02-20",
      "type": "p2p"
    }
];

$(function(){
    var TRANSACTION_DURATION = 120; // in frames

    /*
     * Basic Transfer function that keeps track of Polyline
     * coordinates over TRANSACTION_DURATION number of frames.
     */
    var Transfer = function(start, end){
        this.start = start;
        this.current = start;
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
        if(this.frame == TRANSACTION_DURATION){
            this.current = this.end;
            return true;
        }
        else{
            this.frame++;
            this.current.x += this._xIncrement;
            this.current.y += this._yIncrement;
            return false;
        }
    };

    var transfers = [];
    var locations = {};
    var rows = data.length;

    var load_single = function(data){
        // Only process executed requests.
        if(data.status !== 'executed')
            return;

        var get_payee_loc = function(cb){
            if(!location.hasOwnProperty(data.payee_id)){
                get_account(data.payee_id, function(acc){
                    get_location(acc.customer_id, function(payee_loc){
                        locations[data.payee_id] = payee_loc;
                        if(cb) cb();
                    });
                });
            }
        };

        var get_payer_loc = function(cb){
            if(!location.hasOwnProperty(data.payer_id)){
                get_account(data.payer_id, function(acc){
                    get_location(acc.customer_id, function(payer_loc){
                        locations[data.payer_id] = payer_loc;
                        if(cb) cb();
                    });
                });
            }
        };

        var add_transfer = function(){
            console.log(locations);
            transfers.push(new Transfer(locations[data.payer_id], locations[data.payee_id]));
        };

        if(locations.hasOwnProperty(data.payer_id) && locations.hasOwnProperty(data.payee_id))
            add_transfer();
        else if(!locations.hasOwnProperty(data.payer_id) && locations.hasOwnProperty(data.payee_id))
            get_payer_loc(add_transfer);
        else if(!locations.hasOwnProperty(data.payee_id) && locations.hasOwnProperty(data.payer_id))
            get_payee_loc(add_transfer);
        else
            get_payer_loc(function(){
                get_payee_loc(add_transfer);
            });
    }

    var load_data = function(){
        if(data.length){
            load_single(data.shift());
            setTimeout(load_data, 100);
        }
        else{
        }
    };

    load_data();

    var wait = function(cb){
        if(transfers.length !== rows)
            setTimeout(function(){
                wait(cb);
            }, 100);
        else{
            cb();
        }
    };

    var run = function(){
        var ele = document.getElementById('map');
        var map = new google.maps.Map(ele, {
            zoom: 4,
            center: {lat: 42, lng: -97},
            mapTypeId: google.maps.MapTypeId.TERRAIN
        });

        function render(){
            if(!transfers.length)
                return;

            var transfer = transfers[0];
            console.log([transfer.start,transfer.end]);
            var path = new google.maps.Polyline({
                path: [transfer.start, transfer.end],
                // geodesic: true,
                strokeColor: '#FF0000',
                strokeOpacity: 1.0,
                strokeWeight: 2
            });

            path.setMap(map);

            // if(transfer.increment())
                transfers.shift();

            window.requestAnimationFrame(render);
        }

        window.requestAnimationFrame(render);
    };

    wait(run);
});

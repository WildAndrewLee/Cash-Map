var data = [
  {
    "_id": "56ff682c480cf02f0f88a5af",
    "merchant_id": "56c66be6a73e492741507641",
    "medium": "balance",
    "purchase_date": "2016-04-02",
    "amount": 500,
    "status": "executed",
    "description": "Help",
    "type": "merchant",
    "payer_id": "56ff6705480cf02f0f88a5ab",
    "payee_id": "56c66be6a73e492741507641"
  },
  {
    "_id": "56ff68c6480cf02f0f88a5b2",
    "merchant_id": "56c66be6a73e492741507635",
    "medium": "balance",
    "purchase_date": "2016-04-03",
    "amount": 100,
    "status": "executed",
    "description": "Birthday gift",
    "type": "merchant",
    "payer_id": "56ff6705480cf02f0f88a5ab",
    "payee_id": "56c66be6a73e492741507635"
  },
  {
    "_id": "56ff6a3c480cf02f0f88a5b8",
    "merchant_id": "56c66be6a73e492741507628",
    "medium": "balance",
    "purchase_date": "2016-04-04",
    "amount": 20,
    "status": "executed",
    "description": "Dinner",
    "type": "merchant",
    "payer_id": "56ff6705480cf02f0f88a5ab",
    "payee_id": "56c66be6a73e492741507628"
  }
];

$(function(){
    var TRANSACTION_DURATION = 10; // in frames

    /*
     * Basic Transfer function that keeps track of Polyline
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
     * Restructure all data so that purchases are grouped in subarrays
     * by date.
     */
    var structured_data = [];

    for(var x = 0; x < data.length; x++){
        var last_batch = structured_data[structured_data.length - 1];

        if(!structured_data.length || last_batch[0].purchase_data != data[x].purchase_data){
            last_batch = [];
            structured_data.push(last_batch);
        }

        last_batch.push(data[x]);
    }

    /*
     * Generate a list of dates.
     */
    var dates = [];

    for(var x = 0; x < structured_data.length; x++){
        dates.push(structured_data[x][0].purchase_date);
    }

    /*
     * Runtime variables.
     */
    var transfers = [];
    var locations = {};
    var rows = data.length;
    var payer = null;

    get_account('56ff6705480cf02f0f88a5ab').then(function(acc){
        return get_location(acc.customer_id);
    }).then(function(payer){
        var promise = $.Deferred();

        var load_single = function(data){
            // Only process executed requests.
            if(data.status !== 'executed')
                return;

            var promise = $.Deferred();

            var add_transfer = function(){
                transfers.push(new Transfer(payer, locations[data.merchant_id]));
            };

            if(!locations.hasOwnProperty(data.merchant_id)){
                get_merchant(data.merchant_id).then(function(merchant){
                    locations[data.merchant_id] = merchant.geocode;
                    add_transfer();
                    promise.resolve();
                });
            }
            else{
                add_transfer();
            }

            return promise;
        }

        var all_done = [];

        var load_data = function(){
            if(data.length){
                console.log('getting data');

                setTimeout(function(){
                    all_done.push(load_single(data.shift()));
                }, 100);
            }
            else{
                $.when.apply(null, all_done).done(function(){
                    promise.resolve();
                });
            }
        };

        load_data();

        return promise;
    }).then(function(){
        var ele = document.getElementById('map');
        var map = new google.maps.Map(ele, {
            zoom: 15,
            center: {lat: 39.9050, lng: -75.1652},
        });

        function render(){
            if(!transfers.length)
                return;

            var transfer = transfers[0];
            var path = new google.maps.Polyline({
                path: [transfer.start, transfer.current],
                // geodesic: true,
                strokeColor: '#FF0000',
                strokeOpacity: 1.0,
                strokeWeight: 2
            });

            path.setMap(map);

            if(transfer.increment())
                transfers.shift();

            window.requestAnimationFrame(render);
        }

        map.addListener('tilesloaded', function(){
            window.requestAnimationFrame(render);
            map.removeListener('tilesloaded');
        });
    });
});

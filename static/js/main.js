var API_KEY = "b568190515477bcebfc064f6b6246925";
var API_PATH = 'http://api.reimaginebanking.com';
var geocoder;

$(function(){
    geocoder = new google.maps.Geocoder();
});

// changes a given customer id to its latitude/longtitude coordinates
$(function() {
    $('#convert').click(function() {
        var customer_id = document.getElementById("customer_id").value;
        get_location(customer_id, function(response){
            console.log(response);
            document.getElementById("customer_id").value = "(" + response["lat"] + ", " + response["lng"] + ")";
        });

    });
});

function api_route(){
    var route = API_PATH;

    for(var x = 0; x < arguments.length; x++)
        route += '/' + arguments[x];

    return route + '?key=' + API_KEY;
}

function get_account(account_id){
    var promise = $.getJSON(api_route('accounts', account_id)).promise();

    promise.fail(function(){
        console.log('Unable to fetch account information for ID: ' + account_id);
    });

    return promise;
}

function get_merchant(merchant_id){
    var promise = $.getJSON(api_route('merchants', merchant_id)).promise();

    promise.fail(function(){
        console.log('Unable to fetch merchant information for ID: ' + merchant_id);
    });

    return promise;
}

// gets the customer of a given customer_id
function get_customer(customer_id) {
    var promise = $.getJSON(api_route('customers', customer_id)).promise();

    promise.fail(function(){
        console.log('Unable to fetch customer information for ID: ' + customer_id);
        $('#loading').css('display', 'none');
        $('#does-not-exist').css('display', 'flex');
    });

    return promise;
};

// gets the location of a given customer_id
function get_location(customer_id) {
    var promise = $.Deferred();

    get_customer(customer_id).done(function(response){
        var loc = response['address'];
        var address = loc["street_number"] + " " + loc["street_name"] + ", " + loc["city"] + ", " + loc["state"];

        geocoder.geocode({'address': address}, function(results, status) {
            if (status === google.maps.GeocoderStatus.OK) {
                var lat = results[0].geometry.location.lat();
                var lng = results[0].geometry.location.lng();

                promise.resolve({lat: lat, lng: lng});
            }
            else {
                promise.reject("Geocode was not successful for the following reason: " + status);
            }
        });
    });

    return promise;
};

function get_accounts(customer_id){
    return $.getJSON(api_route('customers', customer_id, 'accounts')).promise();
}

function get_purchases(account_id){
    return $.getJSON(api_route('accounts', account_id, 'purchases')).promise();
}

$("#customer").keyup(function (e) {
    if (e.keyCode == 13) {
        $("#process-customer").click();
    }
});

function map_properties(transfers, height, width) {
    if (transfers.length == 0) return;

    var min_lat = transfers[0].start.lat;
    var min_lng = transfers[0].start.lng;
    var max_lat = transfers[0].start.lat;
    var max_lng = transfers[0].start.lng;

    for (var x = 0; x < transfers.length; x++) {
        if (transfers[x].end.lat < min_lat) min_lat = transfers[x].end.lat;
        if (transfers[x].end.lng < min_lng) min_lng = transfers[x].end.lng;
        if (transfers[x].end.lat > max_lat) max_lat = transfers[x].end.lat;
        if (transfers[x].end.lng > max_lng) max_lng = transfers[x].end.lng;
    }

    var WORLD_DIM = { height: 256, width: 256 };
    var ZOOM_MAX = 21;

    function latRad(lat) {
        var sin = Math.sin(lat * Math.PI / 180);
        var radX2 = Math.log((1 + sin) / (1 - sin)) / 2;
        return Math.max(Math.min(radX2, Math.PI), -Math.PI) / 2;
    }

    function zoom(mapPx, worldPx, fraction) {
        return Math.floor(Math.log(mapPx / worldPx / fraction) / Math.LN2);
    }

    var latFraction = (latRad(max_lat) - latRad(min_lat)) / Math.PI;

    var lngDiff = max_lng - min_lng;
    var lngFraction = ((lngDiff < 0) ? (lngDiff + 360) : lngDiff) / 360;

    var latZoom = zoom(height, WORLD_DIM.height, latFraction);
    var lngZoom = zoom(width, WORLD_DIM.width, lngFraction);

    zoom = Math.min(latZoom, lngZoom, ZOOM_MAX);

    return {
        zoom: zoom,
        center: {
            lat: (max_lat + min_lat) / 2,
            lng: (max_lng + min_lng) / 2
        }
    };
}

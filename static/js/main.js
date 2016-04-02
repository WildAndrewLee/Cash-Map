var API_KEY = "b568190515477bcebfc064f6b6246925";
API_KEY = '?=' + API_KEY;
var geocoder = new google.maps.Geocoder();
var API_PATH = 'http://api.reimaginebanking.com/enterprise/';

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

    return route + API_KEY;
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
function get_customer(customer_id, callback) {
    var promise = $.getJSON(api_route('customers', customer_id).promise());

    promise.fail(function(){
        console.log('Unable to fetch customer information for ID: ' + customer_id);
    });

    return promise;
};

// gets the location of a given customer_id
function get_location(customer_id, callback) {
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

// jumbotron scrolling
function parallax(){
    var scrolled = $(window).scrollTop();
    $('.bg').css('height', (275-scrolled) + 'px');
}
$(window).scroll(function(e){
    parallax();
});

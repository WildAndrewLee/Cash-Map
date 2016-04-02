var API_key = "4e0634307ee72e65b38c6272a292bb41";
var geocoder;
var map;

$(document).ready(function() {
    // make call to get all transfers
    geocoder = new google.maps.Geocoder();

    // unit testing
    // var cb = function(account) {
    //     var customer_id = account["customer_id"];
    //     var print_lat_lng = function(response) {
    //         console.log(response["lat"], response["lng"]);
    //     }
    //     get_location(customer_id, print_lat_lng);
    // };
    // get_account("56c66be6a73e492741507b93", cb);

    // gets all transfers
    // $.ajax({
    //     url: "http://api.reimaginebanking.com/enterprise/transfers?key=4e0634307ee72e65b38c6272a292bb41",
    //     type: "GET",
    //     dataType: "json",
    //     async: "false",
    //     success: function(response) {
    //         console.log(response);
    //     },
    //     error: function(error) {
    //         alert("Unable to load menu");
    //         console.log(error);
    //     }
    // });
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

// gets the account of a given account_id
function get_account(account_id, callback) {
    $.ajax({
        url: "http://api.reimaginebanking.com/enterprise/accounts/" + account_id + "?key=" + API_key,
        type: "GET",
        dataType: "json",
        async: "false",
        success: function(response) {
            callback(response);
        },
        error: function(error) {
            console.log(error);
            alert("Not successful in getting account from given account_id " + account_id);
        }
    });
};

// gets the customer of a given customer_id
function get_customer(customer_id, callback) {
    $.ajax({
        url: "http://api.reimaginebanking.com/enterprise/customers/" + customer_id + "?key=" + API_key,
        type: "GET",
        dataType: "json",
        async: "false",
        success: function(response) {
            callback(response);
        },
        error: function(error) {
            console.log(error);
            alert("Not successful in getting customer from given customer_id " + customer_id);
        }
    });
};

// gets the location of a given customer_id
function get_location(customer_id, callback) {
    var gl_cb = function(response) {
        var loc = response["address"];
        var address = loc["street_number"] + " " + loc["street_name"] + ", " + loc["city"] + ", " + loc["state"];
        geocoder.geocode({'address': address}, function(results, status) {
            if (status == google.maps.GeocoderStatus.OK) {
                var lat = results[0].geometry.location.lat();
                var lng = results[0].geometry.location.lng();
                callback({lat: lat, lng: lng});
            } 
            else {
                alert("Geocode was not successful for the following reason: " + status);
            }
        });
    };
    get_customer(customer_id, gl_cb);
};

// jumbotron scrolling
function parallax(){
    var scrolled = $(window).scrollTop();
    $('.bg').css('height', (275-scrolled) + 'px');
}
$(window).scroll(function(e){
    parallax();
});
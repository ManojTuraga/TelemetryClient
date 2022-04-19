"use strict";

// set initial values for time dropdowns
function set_select(select, value) {
    let options = select.options;
    for (let i = 0; i < options.length; i++) {
        if (options[i].value === value) {
            options[i].selected = true;
            break;
        }
    }
}
set_select(document.getElementById("start-time"), starttime.toString());
set_select(document.getElementById("end-time"), endtime.toString());

// verify dropdown values
function on_select_change() {
    let start = Number(document.getElementById("start-time").value);
    let end = Number(document.getElementById("end-time").value);

    if (start < end) {
        document.getElementById("time-form").submit()
    } else {
        alert("Selected start time must be prior to selected end time");
    }

}

// map
function draw_map() {
    if(location_pairs === null) {
        document.getElementById("map").style.display = 'none';
        document.getElementById("no-info").style.display = 'inline';
        return;
    }

    // location_pairs: [[lat0, lon0], [lat1, lon1], ...] coordinates: [{lat: lat0, lng: lng0}, ...]
    let coordinates = pairs_to_coordinates(location_pairs);

    // initialize the map
    let map = new google.maps.Map(document.getElementById('map'), {center: coordinates[0]});

    // place markers at start and end of data, drawing lines to show car movement in between
    let startmarker = make_marker(coordinates[0], map);
    startmarker.setTitle("Start");
    startmarker.setLabel("S");

    let endmarker = make_marker(coordinates[coordinates.length-1], map);
    endmarker.setTitle("End");
    endmarker.setLabel("E");

    let carpath = new google.maps.Polyline({path: coordinates,
                                            strokeColor: "#2803fc",
                                            strokeOpacity: 1.0,
                                            strokeWeight: 2,
                                            map: map});

    // zoom to a level that covers coordinates
    let bounds = new google.maps.LatLngBounds();
    for(let i=0; i < coordinates.length; i++) {
        bounds.extend(coordinates[i]);
    }
    map.fitBounds(bounds);
}

function make_marker(coordinate, map) {
    return new google.maps.Marker({position: coordinate, map: map});
}

function pairs_to_coordinates(pairs) {
    let coordinates = [];
    for(let i=0; i < pairs.length; i++) {
        coordinates.push({lat: pairs[i][0], lng: pairs[i][1]});
    }
    return coordinates;
}

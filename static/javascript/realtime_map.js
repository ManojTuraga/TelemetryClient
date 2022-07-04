const MAP_STYLES = [ // https://docs.mapbox.com/api/maps/styles/
	"mapbox/outdoors-v11",
	"mapbox/streets-v11",
	"mapbox/satellite-streets-v11",
	"mapbox/satellite-v9",
	"mapbox/dark-v10",
	"mapbox/navigation-night-v1",
];

let map = L.map("map", {
	center: [38.924, -95.675],
	zoom: 14,
});

let baseLayers = {};
for (let mapStyle of MAP_STYLES) {
	baseLayers[mapStyle] = L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
		attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery &copy; <a href="https://www.mapbox.com/">Mapbox</a>',
		maxZoom: 20,
		id: mapStyle,
		tileSize: 512,
		zoomOffset: -1,
		accessToken: MAPBOX_KEY
	});
}

baseLayers[MAP_STYLES[0]].addTo(map);

let path = L.featureGroup().addTo(map);
L.control.layers(baseLayers, {"Car path": path}).addTo(map); // User controls in top-right

let coords = [];

function updateMap(data) {
	if ("gps_lat" in data && "gps_lon" in data) {
		let gps_time = data["gps_dt"] ?? data["gps_time"];
		if (coords.length >= 1 && coords[coords.length-1][3] == gps_time) return;
		coords.push([data["gps_lat"], data["gps_lon"], data["gps_speed"], gps_time]);
		if (coords.length > MAX_DATAPOINTS) coords.splice(0, 1);

		path.clearLayers();
		for (var i = 1; i < coords.length; i++) {
			// 0 mph = blue, 30 mph = green, 60 mph = red
			let hue = 240 - coords[i][2] * 4;
			L.polyline([coords[i-1].slice(0, 2), coords[i].slice(0, 2)], {"color": "hsl(" + hue + ", 100%, 50%)"}).addTo(path);
		}

		if (document.getElementById("map-follow").checked) {
			map.fitBounds(path.getBounds()); // Zoom map to lines
		}

		document.getElementById("head-map").innerText = data["gps_lat"] + ", " + data["gps_lon"];
	}
}

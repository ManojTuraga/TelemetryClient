window.chartColors = {
	red: 'rgb(255, 99, 132)',
	orange: 'rgb(255, 159, 64)',
	yellow: 'rgb(255, 205, 86)',
	green: 'rgb(75, 192, 192)',
	blue: 'rgb(54, 162, 235)',
	purple: 'rgb(153, 102, 255)',
	grey: 'rgb(201, 203, 207)'
};
/*
Function Title Cases a String
JavaScript doesn't have a built in function like Python.
This is used in hideChart() in the innerHTML attribute
*/
function titleCase(str) {
  str = str.toLowerCase().split(' ');
  for (var i = 0; i < str.length; i++) {
    str[i] = str[i].charAt(0).toUpperCase() + str[i].slice(1); 
  }
  return str.join(' ');
}

const MAX_DATAPOINTS = 40;

let color = Chart.helpers.color;

/*
Add the chart to the chart-restoration select.
Hide the chart.
Ensure sel is shown; it could have been hidden if no charts were hidden.
 */

function hideChart(id) {
    let opt = document.createElement('option');
    let sel = document.getElementById('add-chart-sel');
    opt.id = 'opt-' + id;
    opt.value = id;
	console.log(id + ": ID");
    opt.innerHTML = titleCase(id.replaceAll('_', ' '));
    sel.appendChild(opt);
    sel.parentNode.style.display = 'block';
    window.localStorage.setItem('opt-' + id, 0);
    document.getElementById('container-' + id).style.display = 'none';
}

/*
Remove the chart-option from the chart restoration selection.
Reset the selection value to the default option.
If no hidden charts hide sel.
Show the chart.
 */

function showChart(id) {
    let removed_opt = document.getElementById('opt-' + id);
    window.localStorage.setItem('opt-' + id, 1);
    let sel = removed_opt.parentNode;
    sel.removeChild(removed_opt);

    sel.value = "def";  // "Add a chart" option.

    if(sel.childNodes.length === 3) {
        sel.parentNode.style.display = 'none';
    }

    document.getElementById('container-' + id).style.display = 'block';

    $('#card-body-wrap-' + id).collapse('show')
}


// Move the selected chart to the front of the list.


function pinChart(id){
    let cha = document.getElementById('container-' + id);
    let tes = cha.parentNode;
    let fir = tes.firstChild;
    tes.insertBefore(cha, fir);

}

/*
Create Charts based on keys in rt_format
Charts have multiple lines based on each sensor within the category
*/

let charts = {};
function createGraphs()
{
	// Canvases hold contexts. Charts are created by passing a context and a config dict.
	let canvases = Array.from(document.getElementsByClassName("can"));

	for (let canvas of canvases)
	{
		let data_sets = [];
		let data_key = db_format[canvas.id.split("-")[1]];
		let lowest_min = 1000000;
		let highest_max = 0;

		for (let values of data_key)
		{
			data_sets.push({
					backgroundColor: color(window.chartColors[values[1]["color"]]).alpha(0.5).rgbString(),
					borderColor: window.chartColors[values[1]["color"]],
					fill: false,
					data: [],
					name: values[1]["name"],
					label: values[1]["name"],
					unit: values[1]["unit"],
					min: values[1]["safe_min"],
					max: values[1]["safe_max"]
				});
			
			if (values[1]["safe_min"] < lowest_min)
			{
				lowest_min = values[1]["safe_min"];
			}
			if (values[1]["safe_max"] > highest_max)
			{
				highest_max = values[1]["safe_max"];
			}
		}
		let chart = new Chart(canvas.getContext('2d'), {
			type: 'line',
			data: {
				datasets: data_sets
			},
			options: {
				responsive: true,
				title: {
					display: true,
				},
				layout: {
					padding:
					{
						top: -35,
					}
				},
				legend:{
						display: true,
				},
				scales: {
					xAxes: [{
						type: 'time',
						display: true,
						offset: true,
						scaleLabel: {
							display: true,
							labelString: 'Date'
						},
						ticks: {
							maxRotation: 0,
						}
					}],
					yAxes: [{
						display: true,
						scaleLabel: {
							display: true,
							labelString: 'Value'
						},
						ticks: {
							beginAtZero: true,
							min: lowest_min,
							max: highest_max
						}
					}]
				}
			}
		});
		charts[canvas.id.split("-")[1]] = chart;
	}
}
createGraphs();


initialHide(); // TODO: remove?
checkForData();
setInterval(checkForData, 1000);

let prevRawData = "old";
/*
Requests new data and calls updateChart() with it.
 */
function checkForData() {
	// ts for cache busting
	fetch(DATA_URL + "?ts=" + Date.now())
		.then(response => response.text())
		.then(rawData => {
			if (rawData == prevRawData && rawData.includes("cache")) {
				console.log("Ignoring duplicate data");
				return;
			}
			prevRawData = rawData;
			
			console.log("Full response @", (new Date()).toString(), "::", rawData);
			// Find the JSON string within the renpose in case it has other things too (used when accessing DriverHUD data)
			let leftBracket = rawData.lastIndexOf("{");
			let rightBracket = rawData.lastIndexOf("}");
			if (leftBracket == -1 || rightBracket == -1) throw Error("No JSON substring");
			let jsonStr = rawData.substring(leftBracket, rightBracket+1);
			let data = JSON.parse(jsonStr);
			console.log(data);
			document.getElementById("raw-data").innerText = jsonStr.replaceAll(",", ", ");
			document.getElementById("raw-data-all").value += '"' + Date.now() + '": '
				+ document.getElementById("raw-data").innerText + ",\n";
			//data.min_cell_voltage = 3;
			if (!data.timestamp) data.timestamp = Date.now()/1000; // Should only be needed when accessing DriverHUD data directly
			for (let key in data) {
				for (let chart_id in charts)
				{
					let data_key = db_format[chart_id];

					for (const [i, category] of data_key.entries())
					{
						if (category[0] == key)
						{
							updateChart(charts[chart_id], {x: 1000*parseInt(data["timestamp"]), y: parseFloat(data[key])}, i);
						}
					}
				}
            }
			updateMap(data); // In realtime_map.js
			updateFaults(data);
			updateHead();
		});
}


function initialHide() {
    for (let chart_id in charts) {
		console.log(chart_id);
        let show = window.localStorage.getItem('opt-' + chart_id);
        if (show == 0)
		{
			hideChart(chart_id);
		}
	}
}



/*
Updates chart with values with new values(s) in new_data
datapoint format: {x:1618916940000, y:42}
x is unix timestamp, y is sensor reading
 */
function updateChart(chart, datapoint, i) {
	let data = chart.config.data.datasets[i].data;
	chart.config.data.datasets[i].label = chart.config.data.datasets[i].name + ' (' + datapoint.y + chart.config.data.datasets[i].unit + ')';
		// Prevent duplicate datapoints for same time
		if (data.length < 1 || datapoint.x != data[data.length-1].x) {
			data.push(datapoint);
			if (data.length > MAX_DATAPOINTS) data.splice(0, 1);
		}
	chart.update();
}
let bms_errors = [
				//https://www.orionbms.com/manuals/utility_o2/bms_param_dtc_status_1.html
				// DTC #1 Status
   				"Discharge Limit Enforcement",// Discharge Limit
    			"Charger Safety Relay", // Charger Relay
    			"Internal Hardware", // Int Hardware
    			"Internal Heatsink Thermistor", // Int HS Therm
    			"Internal Software", // Int Software
    			"High Cell Voltage Too High", // Max Cell V High"
    			"Low Cell Voltage Too Low",  // Min Cell V Low"
    			"Pack Too Hot", // Pack Too Hot # Reserved
				null,
				null,
				null,
				null,
				null,
				null,
				null,
				null, 
				// DTC #2 Status
				"Internal Communication", // Int Comm
    			"Cell Balancing Stuck Off", // Cell Balancing
    			"Weak Cell", // Weak Cell
    			"Low Cell Voltage", // Low Cell Voltage
    			"Open Wiring", // Open Wiring
    			"Current Sensor", // Current Sensor
    			"Highest Cell Voltage Over 5 Volts", // Max Cell > 5V
    			"Cell ASIC", // Cell ASIC
    			"Weak Pack", // Weak Pack
    			"Fan Monitor", // Fan Monitor
    			"Thermistor", // Thermistor
    			"External Communication", // Ext Comm
    			"Redundant Power Supply", // Redundant PS
    			"High Voltage Isolation", // High Volt Iso
    			"Input Power Supply", // Input PS
    			"Charge Limit Enforcement" // Charge Limit
			];
let motor_errors = [
    			"Motor Angle ID",
    			"Over Voltage",
    			"Low Voltage",
    			null,
    			"Motor Stall",
    			"Internal Volts Fault",
    			"MC Over Temp",
    			null,
    			"Internal Reset",
    			"Hall Throttle Error",
    			"Angle Sensor Error",
    			null,
    			null,
    			"Motor Over Temp",
    			"Hall Galv Sensor Error"
			];
			
let solar_errors = [
				"Battery Volt Level Reached",
				"Overtemperature",
				"No Charge",
				"Undervoltage"
			]
/*
function updates the faults displayed on the faults
canvas
{datapoint: int}
converts to binary and sequentially reads each bit to corresponding error
*/

function updateFaults(data)
{
	
	let binary_bms = Number(data["bms_fault"]).toString(2);
	let binary_solar = Number(data["solar_fault"]).toString(2);
	let binary_motor = Number(data["motor_fault"]).toString(2);
	
	document.getElementById("faults").innerText = "BMS: " + binary_bms;
	document.getElementById("faults").innerText = document.getElementById("faults").innerText + '\n' + "Solar: " + binary_solar;
	document.getElementById("faults").innerText = document.getElementById("faults").innerText + '\n' + "Motor: " + binary_motor;
	document.getElementById("faults").innerText = document.getElementById("faults").innerText + '\n' + "---------------------------";
	
	if ("bms_fault" in data)
	{
		for (let i = bms_errors.length - 1; i >= 0; i--)
		{
			if (binary_bms[i] == '1' && bms_errors[i] != null)
			{
				document.getElementById("faults").innerText = document.getElementById("faults").innerText + '\n' + "BMS: " + bms_errors[i];
			}
		}
		
	}
	if ("solar_fault" in data)
	{
		for (let i = solar_errors.length - 1; i >= 0; i--)
		{
			if (binary_solar[i] == '1' && solar_errors[i] != null)
			{
				document.getElementById("faults").innerText = document.getElementById("faults").innerText + '\n' + "Solar: " + solar_errors[i];
			}
		}
		
	}
	if ("motor_fault" in data)
	{
		for (let i = motor_errors.length - 1; i >= 0; i--)
		{
			if (binary_motor[i] == '1' && motor_errors[i] != null)
			{
				document.getElementById("faults").innerText = document.getElementById("faults").innerText + '\n' + "Motor: " + motor_errors[i];
			}
		}
		
	}
}


/*
Update text at card head with the latest received value.
Update head background color to red if the value is dangerous.
Called from updateChart().
 */
function updateHead() {
	for (let chart_id in charts)
	{
		for (let dataset of charts[chart_id].data.datasets)
		{
			let latest_val = dataset.data[dataset.data.length-1]?.y;
			let head_key = "head-" + chart_id;
			let header = document.getElementById(head_key);
			let card_header = header.parentNode;
			let unsafe_val = latest_val > charts[chart_id].options.scales.yAxes[0].ticks.max || latest_val < charts[chart_id].options.scales.yAxes[0].ticks.min;
			card_header.classList.toggle('bg-danger', unsafe_val);
			card_header.classList.toggle('text-white', unsafe_val);
			//console.log(unsafe_val);
			if (unsafe_val)
			{
				break;
			}
		}
	}
}

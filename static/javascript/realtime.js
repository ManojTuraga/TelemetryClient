window.chartColors = {
	red: 'rgb(255, 99, 132)',
	orange: 'rgb(255, 159, 64)',
	yellow: 'rgb(255, 205, 86)',
	green: 'rgb(75, 192, 192)',
	blue: 'rgb(54, 162, 235)',
	purple: 'rgb(153, 102, 255)',
	grey: 'rgb(201, 203, 207)'
};

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
    opt.innerHTML = db_format[id]['name'];
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

// Canvases hold contexts. Charts are created by passing a context and a config dict.
let canvases = Array.from(document.getElementsByClassName("can"));
let contexts = canvases.map(x => {
    return x.getContext('2d')
});
let charts = {};
function createGraphs()
{

	for (let canvas of canvases)
	{
		let data_sets = [];
		let data_key = db_format[canvas.id.split("-")[1]];

		for (let values of data_key)
		{
			console.log(values[0], values[1]);
			data_sets.push({
					backgroundColor: color(window.chartColors[values[1]["color"]]).alpha(0.5).rgbString(),
					borderColor: window.chartColors[values[1]["color"]],
					fill: false,
					data: [],
					name: values[1]["name"],
					label: values[1]["name"],
					unit: values[1]["unit"]
				});
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
							min: 0,
							suggestedMax: 10
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


/*
Requests new data and calls updateChart() with it.
 */
function checkForData() {
	fetch("/realtime/data?ts=" + Date.now())
		.then(response => response.json())
		.then(data => {
			//data.min_cell_voltage = 3;
			//data.timestamp = Date.now()
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
		});
}


function initialHide() {
    for (let chart in charts) {
        let parsed_id = chart;
        let show = window.localStorage.getItem('opt-' + parsed_id);
        if (show == 0) hideChart(parsed_id);
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
	console.log(data)
		// Prevent duplicate datapoints for same time
		if (data.length < 1 || datapoint.x != data[data.length-1].x) {
			data.push(datapoint);
			if (data.length > MAX_DATAPOINTS) data.splice(0, 1);
		}
	chart.update();
	//updateHead(chart)
}


/*
Update text at card head with the latest received value.
Update head background color to red if the value is dangerous.
Called from updateChart().
 */
function updateHead(chart) {
    let latest_val = chart.config.data.datasets[0].data[chart.config.data.datasets[0].data.length-1].y;
    let data_key = chart.canvas.id.split("-")[1];
    let head_key = "head-" + data_key;
    let header = document.getElementById(head_key);
    header.innerText = latest_val;

    let card_header = header.parentNode;
    let unsafe_val = false;
	for (let i = 0; i < db_format.length; i++)
	{
		if (db_format[data_key][i][2]["safe_max"] != null && db_format[data_key][i][2]["safe_min"] != null)
			unsafe_val = latest_val > db_format[data_key]["safe_max"] || latest_val < db_format[data_key]["safe_min"];
		card_header.classList.toggle('bg-danger', unsafe_val);
		card_header.classList.toggle('text-white', unsafe_val);

	}
}

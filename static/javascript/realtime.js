window.chartColors = {
	red: 'rgb(255, 99, 132)',
	orange: 'rgb(255, 159, 64)',
	yellow: 'rgb(255, 205, 86)',
	green: 'rgb(75, 192, 192)',
	blue: 'rgb(54, 162, 235)',
	purple: 'rgb(153, 102, 255)',
	grey: 'rgb(201, 203, 207)'
};


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
    let sel = removed_opt.parentNode;
    sel.removeChild(removed_opt);

    sel.value = "def";  // "Add a chart" option.

    if(sel.childNodes.length === 3) {
        sel.parentNode.style.display = 'none';
    }

    document.getElementById('container-' + id).style.display = 'block';

    $('#card-body-wrap-' + id).collapse('show')
}


// Canvases hold contexts. Charts are created by passing a context and a config dict.
let canvases = Array.from(document.getElementsByClassName("can"));
let contexts = canvases.map(x => {
    return x.getContext('2d')
});
let charts = contexts.map(x => new Chart(x, {
    type: 'line',
    data: {
        datasets: [{
            backgroundColor: color(window.chartColors.blue).alpha(0.5).rgbString(),
            borderColor: window.chartColors.blue,
            fill: false,
            data: []
        }]
    },
    options: {
        responsive: true,
        title: {
            display: true,
        },
		legend: {
        	display: false,
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
                    labelString: 'value'
                },
                ticks: {
                    beginAtZero: true,
                    min: 0,
                    suggestedMax: 10
                }
            }]
        }
    }
}));

setInterval(checkForData, 2000);


/*
Requests new data and calls updateChart() with it.
 */
function checkForData() {
    const http = new XMLHttpRequest();
    const url = "/realtime/data";
    http.open("GET", url);
    http.send();

    http.onreadystatechange = function () {
        if (this.readyState === 4 && this.status === 200) {
            let data = JSON.parse(http.responseText);
            for (let key in data) {
                for(let i = 0; i < charts.length; i++) {
                    let chart = charts[i];
                    let parsed_id = chart.canvas.id.split("-")[1];
                    if(parsed_id === key) {
                        updateChart(chart, [1000*parseInt(data["gps_time"])], [parseInt(data[key])]);
                    }
                }
            }
        }
    };
}


/*
Updates chart with values with paired values from time_queue, new_data_queue
 */
function updateChart(chart, time_queue, new_data_queue) {
	let data = chart.config.data.datasets[0].data;
	for (let i=0; i < new_data_queue.length; i++) {
		if(data.length > 5) {
			data.splice(0, 1);
		}
		data.push({
			x: time_queue[i],
			y: new_data_queue[i]
		});
		time_queue.splice(i, 1);
		new_data_queue.splice(i, 1);
		chart.update();
    }
	updateHead(chart)
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
    let unsafe_val = latest_val > db_format[data_key]["safe_max"] || latest_val < db_format[data_key]["safe_min"];
    card_header.classList.toggle('bg-danger', unsafe_val);
    card_header.classList.toggle('text-white', unsafe_val);
}

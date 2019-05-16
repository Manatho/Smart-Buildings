var tempChart;
var co2Chart;
var peopleChart;
var consumptionChart;
var charts = [];

setInterval(updateCharts, 5000);

function createCharts() {
    tempChart = newChart('liveTempChart', 'Degrees Celcius')
    co2Chart = newChart('liveCo2Chart', 'kg')
    peopleChart = newChart('livePeopleChart', 'number of people')
    consumptionChart = newChart('liveConsumptionChart', 'kw')
    charts.push({ chart: tempChart, options: { color: 'rgba(0, 255, 0, 0.3)', name: 'temperature' } },
        { chart: co2Chart, options: { color: 'rgba(255,0,0,0.3)', name: 'co2' } },
        { chart: peopleChart, options: { color: 'rgba(255, 255, 0, 0.3)', name: 'people' } },
        { chart: consumptionChart, options: { color: 'rgba(0,0,255, 0.3)', name: 'consumption' } });
}

function newChart(id, yLabelName) {
    let ctx = document.getElementById(id).getContext('2d');
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            maintainAspectRatio: false,
            scales: {
                yAxes: [{
                    scaleLabel: {
                        display: true,
                        labelString: yLabelName
                    },

                    ticks: {
                        beginAtZero: true
                    }
                }],
                xAxes: [{
                    scaleLabel: {
                        display: true,
                        labelString: "Time"
                    },
                }]
            }
        }

    })
}

createCharts();

var previousLastObject;
function updateCharts() {
    fetch("./public/livedata.json")
        .then(response => response.json())
        .then(function (json) {
            if (JSON.stringify(previousLastObject) != JSON.stringify(json[json.length - 1])) {
                // generate xAxisNames
                var labels = json.map(obj => {
                    let time = new Date(obj.time * 1000);
                    time.setHours(time.getHours() - 1);
                    return ("0" + time.getHours()).slice(-2) + ":" + ("0" + time.getMinutes()).slice(-2);
                });

                charts.forEach(object => {
                    removeData(object.chart);
                    let data = json.map(datapoint => datapoint[object.options.name]);
                    addData(object.chart, labels, data, object.options.color, object.options.name);

                })
            }
            previousLastObject = json[json.length - 1]
        });

}

function removeData(chart) {
    chart.data.labels = [];
    chart.data.datasets = [];
    chart.update();
}

function addData(chart, labels, data, color, field) {
    chart.data.labels = labels;
    chart.data.datasets.push({
        lineTension: 0,
        label: field,
        backgroundColor: [
            color
        ],
        data: data,
        borderWidth: 1
    })

    chart.update();
}
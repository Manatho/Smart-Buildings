var tempChart;
var co2Chart;
var peopleChart;


setInterval(updateCharts, 5000);

function createCharts() {
    tempChart = newChart('liveTempChart', 'Degrees Celcius')
    co2Chart = newChart('liveCo2Chart', 'kg')
    peopleChart = newChart('livePeopleChart', 'number of people')
}

function newChart(id, field) {
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
                        labelString: field
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

// {
//     lineTension: 0,
//         label: 'temperature',
//             backgroundColor: [
//                 'rgba(0, 255, 0, 0.3)'
//             ],
//                 borderWidth: 1
// }

createCharts();

function updateCharts() {
    fetch("./public/livedata.json")
        .then(response => response.json())
        .then(function (json) {
            if (json.length == tempChart.data.labels.length) {
                return;
            } else {
                removeData(tempChart)
                let tempData = json.map(obj => obj.temperature)
                let labels = json.map(obj => obj.time)
                addData(tempChart, labels, tempData, 'rgba(0, 255, 0, 0.3)', 'temperature');
            }

            if (json.length == co2Chart.data.labels.length) {
                return;
            } else {
                removeData(co2Chart)
                let co2Data = json.map(obj => obj.co2)
                let labels = json.map(obj => obj.time)
                addData(co2Chart, labels, co2Data, 'rgba(255,0,0,0.3)', 'co2');
            }

            if (json.length == peopleChart.data.labels.length) {
                return;
            } else {
                removeData(peopleChart)
                let peopleData = json.map(obj => obj.people)
                let labels = json.map(obj => obj.time)
                addData(peopleChart, labels, peopleData, 'rgba(255, 255, 0, 0.3)', 'people');
            }
        });
    //let tempData = data.map(obj => obj.temperature)
    //tempChart.data.datasets = tempData;

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
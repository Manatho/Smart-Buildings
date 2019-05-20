let lastPredictionTime = 0;

setInterval(updatePrediction, 5000);
updatePrediction();

function updatePrediction() {
    fetch("public/predicted.json")
        .then(response => response.json())
        .then(json => {
            if (json.creationTime !== lastPredictionTime) {
                render(json);
                lastPredictionTime = json.creationTime;
            }
        })
}

function render(predict) {
    //TempPeopleCO2Model
    
    let co2Model = new AdvancedModel(predict.startTemp, predict.roomDimensions, predict.startCO2, predict.comfortRange, predict.emptyRange);
    let result = co2Model.predict(predict.timestep, predict.data, predict.demandRange, predict.demandPower);
    co2Model.rails = result.stateSequence;
    let defaultConsumption = result.default;
    let optimizedConsumption = result.optimized;
    //console.log(result);
    //console.log(defaultConsumption, optimizedConsumption);
    

    let hourNumber = 0;
    let showData = [];
    predict.data.forEach(o => {
        co2Model.update(predict.timestep, o.temperature, o.people);
        let prevConsumption = co2Model.currentConsumption;
        showData.push({ time: o.time, consumption: prevConsumption, co2: co2Model.currentCO2, temperature: co2Model.currentTemperature })
    })
    
    console.log(predict.demandRange.lower, predict.demandRange.higher);
    
    let formattedData = `<h3>Model</h3>
    <div style="background-color: #efefef; white-space: nowrap; overflow-x: scroll; height: 30%; width:100%;">
    Temperature: <b>${predict.startTemp}&#176;</b> &nbsp;&nbsp; Room: <b>${co2Model.roomVolume}m&#179;</b> &nbsp&nbsp CO2: <b>${predict.startCO2}kg</b> &nbsp &nbsp<br>
    Comfort Range: <b>${predict.comfortRange.lower}&#176</b> to <b>${predict.comfortRange.higher}&#176</b> if empty:  <b>${predict.emptyRange.lower}&#176</b> to <b>${predict.emptyRange.higher}&#176</b><br>
    CO2 Range: <b>${co2Model.CO2Rangekg.lower}kg</b> to <b>${co2Model.CO2Rangekg.higher}kg</b> for a room size <b>${co2Model.roomVolume}m&#179;</b><br><br>
    DemandResponse: <b>${("0" + (((predict.demandRange.lower*10)/60) << 0)).slice(-2)}:${("0" + ((predict.demandRange.lower*10)%60)).slice(-2)}</b> to <b>${("0" + (((predict.demandRange.higher*10)/60) << 0)).slice(-2)}:${("0" + ((predict.demandRange.higher*10)%60)).slice(-2)}</b> with <b>${predict.demandPower}</b>kW/h <br>
    Could fulfill: <b>${result.possible.toString().toUpperCase()}</b><br>
    Consumption without <b>${defaultConsumption.toFixed(2)}</b>kW/h with <b>${optimizedConsumption.toFixed(2)}</b>kW/h 
    </div> 
    <h2>Data</h2>
    <div style="background-color: #efefef; white-space: nowrap; font-size:px; overflow-y: scroll; height: 43%;">
    `;
    predict.data.forEach(dp => {
        let time = new Date(dp.time * 1000);
        time.setHours(time.getHours() - 1);
        let timestring = ("0" + time.getHours()).slice(-2) + ":" + ("0" + time.getMinutes()).slice(-2);
        formattedData += `Time: <b>${timestring}</b> &nbsp;&nbsp;&nbsp;&nbsp;  Temperature: <b>${dp.temperature}</b> &nbsp;&nbsp;&nbsp;&nbsp; People: <b>${dp.people}</b><br>`
    })
    formattedData += `</div>`
    document.getElementById("data").innerHTML = formattedData;

    renderChart(showData, 'co2Chart', 'co2', 'rgba(255,0,0,0.3)')
    renderChart(showData, 'tempChart', 'temperature', 'rgba(0,255,0,0.3)')
    renderChart(showData, 'consumptionChart', 'consumption', 'rgba(0,0,255, 0.3)')
}



function renderChart(showData, canvasId, field, color) {
    let ctx = document.getElementById(canvasId).getContext('2d');



    let labels = showData.map(obj => {
        let time = new Date(obj.time * 1000);
        time.setHours(time.getHours() - 1);
        return ("0" + time.getHours()).slice(-2) + ":" + ("0" + time.getMinutes()).slice(-2);
    });
    let dataTemp = showData.map(obj => obj[field]);
    let myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                lineTension: 0,
                label: field,
                data: dataTemp,
                backgroundColor: [
                    color
                ],
                borderWidth: 1
            }]
        },
        options: {
            maintainAspectRatio: false,
            scales: {
                yAxes: [{
                    scaleLabel: {
                        display: true,
                        labelString: unitPicker(field)
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
    });
}

function unitPicker(name) {
    switch (name) {
        case "co2":
            return "kg";
        case "consumption":
            return "kW"
        case "temperature":
            return "Degrees Celsius"
    }
}

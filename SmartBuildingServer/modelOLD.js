const HeatpumpConsumption = 2.6 / 3600;
const HeatpumpTemperatureChange = 2.0 / 3600;
const QHuman = 0.5 / 3600;
const WallLoss = 1.0 / 3600;

class TempPeopleModel {
    constructor(startTemp, tempPeopleRange, tempNoPeopleRange) {
        this.tempRangePeople = tempPeopleRange;
        this.tempRangeNoPeople = tempNoPeopleRange;
        this.currentTemperature = startTemp;
        this.previousTemperature = startTemp;
        this.numberOfPeople = 0;

        this.heatPumpState = 0;
        this.rails = [];
        this.railIndex = 0;

    }

    heatPumpSupply(delta) {
        return this.heatPumpState * (HeatpumpTemperatureChange * delta);
    }

    heatGain(delta) {
        return (QHuman * delta) * this.numberOfPeople;
    }

    ambientLoss(delta, outsideTemp) {
        if (outsideTemp < this.currentTemperature) {
            return -WallLoss * delta;
        } else if (outsideTemp > this.currentTemperature) {
            return WallLoss * delta;
        } else {
            return 0;
        }
    }

    heatPumpUpdate() {
        if (this.rails.length > this.railIndex) {
            this.heatPumpState = this.rails[this.railIndex++];
            return;
        }
        if (this.numberOfPeople > 0) {
            if (this.currentTemperature < this.tempRangePeople.lower) {
                this.heatPumpState = 1;
            } else if (this.currentTemperature > this.tempRangePeople.higher) {
                this.heatPumpState = -1
            } else {
                this.heatPumpState = 0;
            }
        } else {
            if (this.currentTemperature < this.tempRangeNoPeople.lower) {
                this.heatPumpState = 1;
            } else if (this.currentTemperature > this.tempRangeNoPeople.higher) {
                this.heatPumpState = -1
            } else {
                this.heatPumpState = 0;
            }
        }
    }

    consumption(delta) {
        return Math.abs(HeatpumpConsumption * delta * this.heatPumpState);
    }

    update(delta, outsideTemp, numberOfPeople) {
        this.previousTemperature = this.currentTemperature;
        this.numberOfPeople = numberOfPeople;

        this.currentTemperature = this.previousTemperature + this.heatGain(delta) + this.heatPumpSupply(delta) + this.ambientLoss(delta, outsideTemp);

        this.heatPumpUpdate();
        return this.heatPumpState;
    }

    predict(delta, data, responseRange, responseTarget) {
        let simulated = this.copy();
        let totalConsumption = 0;

        let heatCount = 0;
        let coolCount = 0;
        data.forEach((datapoint, index) => {
            simulated.update(delta, datapoint.temperature, datapoint.people);
            if (index >= responseRange.lower && index <= responseRange.higher) {
                totalConsumption += simulated.consumption(delta);
                if (simulated.heatPumpState == 1) {
                    heatCount++
                } else if (simulated.heatPumpState == -1) {
                    coolCount++;
                }
            }
        })
        if (totalConsumption > responseTarget) {
            let testModel = {};
            console.log(`${coolCount}, ${heatCount}`)
            if (coolCount > heatCount) {
                testModel = generateStateSequence(this.copy(), data, responseRange, delta, "precool");
            } else {
                testModel = generateStateSequence(this.copy(), data, responseRange, delta, "preheat");
            }
            totalConsumption = 0;
            data.forEach((datapoint, index) => {
                testModel.update(delta, datapoint.temperature, datapoint.people);
                if (index >= responseRange.lower && index <= responseRange.higher) {
                    totalConsumption += testModel.consumption(delta);
                }
            })
            if (totalConsumption > responseTarget) {
                return { possible: false, stateSequence: [] };
            } else {
                return { possible: true, stateSequence: testModel.rails };
            }
        } else {
            return { possible: true, stateSequence: [] };
        }
    }

    copy() {
        let o = JSON.parse(JSON.stringify(this));
        let newModel = new TempPeopleModel(o.currentTemperature, o.tempRangePeople, o.tempRangeNoPeople);
        newModel.numberOfPeople = o.numberOfPeople;
        newModel.heatPumpState = o.heatPumpState;
        newModel.rails = o.rails;
        newModel.railIndex = o.railIndex;
        return newModel;
    }

    toString() {
        return JSON.stringify(this);
    }
}

function generateStateSequence(model, data, responseRange, delta, strategy) {
    let initialModel = model.copy();
    let sequence = [];
    if (strategy == "precool") {
        model.tempRangePeople.higher = model.tempRangePeople.lower;
        model.tempRangeNoPeople.higher = model.tempRangeNoPeople.lower;
    } else if (strategy == "preheat") {
        model.tempRangePeople.lower = model.tempRangePeople.higher;
        model.tempRangeNoPeople.lower = model.tempRangeNoPeople.higher;
    }
    console.log(model.tempRangePeople, model.tempRangeNoPeople)
    for (var i = 0; i < responseRange.lower; i++) {
        let prevConsumption = model.consumption(delta);
        sequence[i] = model.update(delta, data[i].temperature, data[i].people);
        console.log(`${hourNumber++} \t| ${prevConsumption} \t| ${model.previousTemperature}\t| ${model.currentTemperature}`);
    }
    initialModel.rails = sequence;
    return initialModel;
}



let model = new TempPeopleModel(16, { lower: 20, higher: 25 }, { lower: 16, higher: 25 });

// var hourNumber = 1;
// [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34].forEach(temp => {
//     let prevConsumption = model.consumption(3600);
//     model.update(3600, temp, 0);
//     console.log(`${hourNumber++} \t| ${prevConsumption} \t| ${model.previousTemperature}\t| ${model.currentTemperature}`);
// })

var data = [{ temperature: 14, people: 0 },
{ temperature: 14, people: 1 },
{ temperature: 14, people: 1 },
{ temperature: 14, people: 1 },
{ temperature: 14, people: 1 },
{ temperature: 14, people: 1 },
{ temperature: 14, people: 1 },
{ temperature: 14, people: 1 },
{ temperature: 14, people: 1 },
{ temperature: 14, people: 1 },
{ temperature: 14, people: 1 },
{ temperature: 14, people: 1 },
{ temperature: 14, people: 1 },
{ temperature: 14, people: 1 },
{ temperature: 14, people: 1 },
{ temperature: 14, people: 1 },
{ temperature: 14, people: 1 },
{ temperature: 14, people: 1 },
{ temperature: 14, people: 1 },
{ temperature: 14, people: 1 },
{ temperature: 14, people: 1 },
{ temperature: 14, people: 1 },
{ temperature: 14, people: 1 },
{ temperature: 14, people: 1 }];



var modelSequence = model.predict(3600, data, { lower: 16, higher: 20 }, 0);
model.rails = modelSequence.stateSequence;
console.log(modelSequence)
var hourNumber = 1;
data.forEach(o => {
    let prevConsumption = model.consumption(3600);
    model.update(3600, o.temperature, o.people);
    console.log(`${hourNumber++} \t| ${prevConsumption} \t| ${model.previousTemperature}\t| ${model.currentTemperature}`);
})


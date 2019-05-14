const hour = 3600;

const HeatpumpConsumption = 2.6 / hour;
const VentilationConsumption = 0.205 / hour;

const HeatpumpTemperatureChange = 2.0 / hour;
const QHuman = 0.5 / hour;
const WallLoss = 1.0 / hour;

const CO2Human= 0.0375 / hour; //kg
const passiveCO2Leak = 0.01 / hour;
const CO2Range = {lower: 350, higher: 1000} //PPM

const outsideCO2Concentration = 0.405 //kg

class TempPeopleCO2Model {
    constructor(startTemp, roomsize, startCO2, tempPeopleRange, tempNoPeopleRange) {
        this.tempRangePeople = tempPeopleRange;
        this.tempRangeNoPeople = tempNoPeopleRange;
        this.currentTemperature = startTemp;
        this.previousTemperature = startTemp;
        this.numberOfPeople = 0;

        this.previousCO2 = startCO2;
        this.currentCO2 = startCO2;
        this.roomsize = roomsize;

        this.CO2Rangekg = {lower: (CO2Range.lower/1000) * roomsize, higher: (CO2Range.higher/1000) * roomsize}
        
        this.heatPumpState = 0;
        this.rails = [];
        this.railIndex = 0;

        this.averageOffSwitchOverride = false

        this.ventilationThroughput = 0;
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
            let proposedState =  this.rails[this.railIndex].heatpump;
            if(!Number.isNaN(proposedState)){
                this.heatPumpState = proposedState
                return;
            }
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

    // 0,0375 kg/h+0,01 kg/h= 0,0475 kg
    // 0,0475 kg / 50 m3=0,00095 kg/m3/h
    // 0,60 kg/m3 + 0,00095=0,60095 kg/m3
    // (0,60095 kg/m3*50m3) - 0,60095 kg = 
    


    ventilationUpdate(){
        if (this.rails.length > this.railIndex) {
            this.ventilationThroughput = this.rails[this.railIndex].ventilation;
            return;
        }

        if(this.currentCO2 > this.CO2Rangekg.higher) {
            this.ventilationThroughput = 1;
        } else// if(this.currentCO2 < (this.CO2Rangekg.higher + this.CO2Rangekg.lower) / 2 || this.averageOffSwitchOverride)
        {
            this.ventilationThroughput = 0;
        }
    }

    ventilationSupply(delta){
        if(this.ventilationThroughput == 0){
            return 0;
        }
        let airMoved = (this.ventilationThroughput/hour * delta);
        let removedCO2Weight = (this.currentCO2 / this.roomsize) * airMoved;
        let newAirCO2 = outsideCO2Concentration * airMoved;

        return -removedCO2Weight + newAirCO2;

    }

    ambientCo2Loss(delta){
        return passiveCO2Leak * delta;
    }

    
    co2Gain(delta){
        return (CO2Human * delta) * this.numberOfPeople;
    }


    consumption(delta) {
        let ventilation = VentilationConsumption * this.ventilationThroughput * delta;
        let heatPump = Math.abs(HeatpumpConsumption * delta * this.heatPumpState);
        return ventilation + heatPump;
    }

    update(delta, outsideTemp, numberOfPeople) {
        this.previousTemperature = this.currentTemperature;
        this.previousCO2 = this.currentCO2;
        this.numberOfPeople = numberOfPeople;

        this.currentTemperature = this.previousTemperature + this.heatGain(delta) + this.heatPumpSupply(delta) + this.ambientLoss(delta, outsideTemp);
        this.currentCO2 = this.previousCO2 + this.ventilationSupply(delta) + this.ambientCo2Loss(delta) + this.co2Gain(delta);

        this.heatPumpUpdate();
        this.ventilationUpdate();
        if(this.rails.length > this.railIndex) {
            this.railIndex++;
        }

        return {heatpump: this.heatPumpState, ventilation: this.ventilationThroughput};
    }

    predict(delta, data, responseRange, responseTarget) {
        let simulated = this.copy();
        let totalConsumption = 0;

        let heatCount = 0;
        let coolCount = 0;
        let ventilation = 0;
        data.forEach((datapoint, index) => {
            simulated.update(delta, datapoint.temperature, datapoint.people);
            if (index >= responseRange.lower && index <= responseRange.higher) {
                totalConsumption += simulated.consumption(delta);
                if (simulated.heatPumpState == 1) {
                    heatCount++
                } else if (simulated.heatPumpState == -1) {
                    coolCount++;
                }
                if(simulated.ventilationThroughput > 0){
                    ventilation+= simulated.ventilationThroughput;
                }
            }
        })
        if (totalConsumption > responseTarget) {
            let testModel = {};

            if(heatCount == 0 && coolCount == 0){
                testModel = generateStateSequence(this.copy(), data, responseRange, delta, "ventilation");
            } else {
                if(ventilation == 0){
                    if (coolCount > heatCount) {
                        testModel = generateStateSequence(this.copy(), data, responseRange, delta, "precool");
                    } else {
                        testModel = generateStateSequence(this.copy(), data, responseRange, delta, "preheat");
                    }
                } else {
                    if (coolCount > heatCount) {
                        testModel = generateStateSequence(this.copy(), data, responseRange, delta, "precool ventilation");
                    } else {
                        testModel = generateStateSequence(this.copy(), data, responseRange, delta, "preheat ventilation");
                    }
                }
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
        let newModel = new TempPeopleCO2Model(o.currentTemperature, o.roomsize, o.currentCO2, o.tempRangePeople, o.tempRangeNoPeople);
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
    let strategies = strategy.split(" ");
    
    let initialModel = model.copy();
    let sequence = [];

    if (strategies.includes("precool")) {
        model.tempRangePeople.higher = model.tempRangePeople.lower;
        model.tempRangeNoPeople.higher = model.tempRangeNoPeople.lower;
    } 
    if (strategies.includes("preheat")) {
        model.tempRangePeople.lower = model.tempRangePeople.higher;
        model.tempRangeNoPeople.lower = model.tempRangeNoPeople.higher;
    }
    if(strategies.includes("ventilation")){
        model.CO2Rangekg.higher = model.CO2Rangekg.lower;
        initialModel.averageOffSwitchOverride = true;
    }

    console.log(model.tempRangePeople, model.tempRangeNoPeople)
    for (var i = 0; i < responseRange.lower; i++) {
        let prevConsumption = model.consumption(delta);
        sequence[i] = model.update(delta, data[i].temperature, data[i].people);
        console.log(`${hourNumber++} \t| ${prevConsumption} \t| ${model.currentCO2}\t| ${model.currentTemperature}`);
    }


    initialModel.rails = sequence;
    
    return initialModel;
}



// let model = new TempPeopleModel(16, { lower: 20, higher: 24 }, { lower: 16, higher: 25 });

// var hourNumber = 1;
// [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34].forEach(temp => {
//     let prevConsumption = model.consumption(3600);
//     model.update(3600, temp, 0);
//     console.log(`${hourNumber++} \t| ${prevConsumption} \t| ${model.previousTemperature}\t| ${model.currentTemperature}`);
// })

var data = [
{ temperature: 14, people: 10 },
{ temperature: 14, people: 10 },
{ temperature: 14, people: 10 },
{ temperature: 14, people: 10 },
{ temperature: 14, people: 10 },
{ temperature: 14, people: 10 },
{ temperature: 14, people: 10 },
{ temperature: 14, people: 10 },
{ temperature: 14, people: 10 },
{ temperature: 14, people: 10 },
{ temperature: 14, people: 10 },
{ temperature: 14, people: 10 },
{ temperature: 14, people: 10 },
{ temperature: 14, people: 10 },
{ temperature: 14, people: 10 },
{ temperature: 14, people: 10 },
{ temperature: 14, people: 10 },
{ temperature: 14, people: 10 },
{ temperature: 14, people: 10 },
{ temperature: 14, people: 10 },
{ temperature: 14, people: 10 },
{ temperature: 14, people: 10 },
{ temperature: 14, people: 10 },
{ temperature: 14, people: 10 }];



// var modelSequence = model.predict(3600, data, { lower: 16, higher: 20 }, 0);
// model.rails = modelSequence.stateSequence;
// console.log(modelSequence)
// var hourNumber = 1;
// data.forEach(o => {
//     let prevConsumption = model.consumption(3600);
//     model.update(3600, o.temperature, o.people);
//     console.log(`${hourNumber++} \t| ${prevConsumption} \t| ${model.previousTemperature}\t| ${model.currentTemperature}`);
// })

let co2Model = new TempPeopleCO2Model(16, 50, 49, {lower: -100, higher: 500}, {lower: -100, higher: 500});

var modelSequence = co2Model.predict(3600, data, { lower: 15, higher: 17 }, 0.3);
co2Model.rails = modelSequence.stateSequence;
console.log(modelSequence)
var hourNumber = 0;
data.forEach(o => {
    let prevConsumption = co2Model.consumption(3600);
    co2Model.update(3600, o.temperature, o.people);
    console.log(`${hourNumber++} \t| ${prevConsumption} \t| ${co2Model.currentCO2}\t| ${co2Model.currentTemperature}`);
})

// for (let i = 0; i < 10; i++) {
//     co2Model.update(3600, 0, 16);
//     console.log(i+1, co2Model.currentCO2, co2Model.ventilationThroughput);
// }


const HeatpumpConsumption = 2.6;
const HeatpumpTemperatureChange = 1;
const QHuman = 0.5;

class TempPeopleModel {
    constructor (startTemp, tempPeopleRange, tempNoPeopleRange) {
        this.tempRangePeople = tempPeopleRange;
        this.tempRangeNoPeople = tempNoPeopleRange;
        this.currentTemperature = startTemp;
        this.previousTemperature = startTemp;
        this.numberOfPeople = 5;
        
        this.heatPumpState = 0;
    }

    heatPumpSupply(){
        return this.heatPumpState * HeatpumpTemperatureChange;
    }

    heatGain(){
        return QHuman * this.numberOfPeople;    
    }

    ambientLoss(outsideTemp){
        if(outsideTemp < this.currentTemperature) {
            return -1;
        } else if(outsideTemp > this.currentTemperature) {
            return 1;
        } else {
            return 0
        }
    }

    heatPumpUpdate(){
        if(this.numberOfPeople > 0){
            if(this.currentTemperature < this.tempRangePeople.lower) {
                this.heatPumpState = 1;
            } else if(this.currentTemperature > this.tempRangePeople.higher) {
                this.heatPumpState = -1
            } else {
                this.heatPumpState = 0;
            }
        } else {
            if(this.currentTemperature < this.tempRangeNoPeople.lower) {
                this.heatPumpState = 1;
            } else if(this.currentTemperature > this.tempRangeNoPeople.higher) {
                this.heatPumpState = -1
            } else {
                this.heatPumpState = 0;
            }
        }
    }

    consumption(){
        return this.HeatpumpConsumption;
    }

    update(outsideTemp, numberOfPeople){
        this.previousTemperature = this.currentTemperature;
        this.numberOfPeople = numberOfPeople;

        this.currentTemperature = this.previousTemperature + this.heatGain() + this.heatPumpSupply() + this.ambientLoss(outsideTemp); 
        this.heatPumpUpdate();
    }

    predict(data, responseRange, responseTarget) {
        let simulated = this.copy();
        let totalConsumption = 0;

        data.forEach((datapoint, index) => {
            simulated.update(datapoint.temperature, datapoint.people);
            if(index >= responseRange.lower && index <= responseRange.higher)
                totalConsumption += simulated.consumption();
        })

        return {possible: responseTarget < totalConsumption, stateSequence: []};

    }

    copy(){
        return JSON.parse(JSON.stringify(this));
    }

    toString(){
        return JSON.stringify(this);
    }
}

let model = new TempPeopleModel(16, {lower: 20, higher: 22}, {lower: 16, higher: 26});


[20,21,22,23,24,25,26,27,28,29,30, 31, 32, 33, 34].forEach(temp => {
    model.update(temp, 0);
    console.log(model);
})


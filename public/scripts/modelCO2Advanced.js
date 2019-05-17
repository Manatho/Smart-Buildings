
const HeatResistanceWall = 1 / 0.37;

const DensityAir = 1.2;
const HeatCapacityAir = 717.5;

const DensityWall = 1800;
const WallThickness = 0.12;
const HeatCapacityWall = 840;

const HumanHeatGain = 100; //W

const HeatPumpCapacity = 3500; //W

const hour = 3600;
const VentilationConsumption = 0.205 / hour;
const VentilationMaxThroughput = 5;
const HeatpumpConsumption = 2.6 / hour;

const COPCarnotHeatPump = 4;

const CO2Human = 0.0375 / hour; //kg
const passiveCO2Leak = 0.01 / hour;
const CO2Range = { lower: 350, higher: 1000 } //PPM

const outsideCO2Concentration = 0.405 //kg


class AdvancedModel {
	constructor(startTemp, roomsize, startCO2, tempPeopleRange, tempNoPeopleRange) {
		this.tempRangePeople = tempPeopleRange;
		this.tempRangeNoPeople = tempNoPeopleRange;
		this.currentTemperature = startTemp;
		this.previousTemperature = startTemp;
		this.numberOfPeople = 0;

		this.wallLength = roomsize.length;
        this.wallWidth = roomsize.width;
        this.wallHeight = roomsize.height;
        this.roomSurfaces = this.wallLength * this.wallWidth * 2 + this.wallLength * this.wallHeight * 2 + this.wallWidth * this.wallHeight * 2;
        this.roomVolume = this.wallHeight * this.wallWidth * this.wallLength;
        this.roomFloor = this.wallLength * this.wallWidth;

		this.previousCO2 = startCO2;
		this.currentCO2 = startCO2;

		this.CO2Rangekg = { lower: (CO2Range.lower / 1000) * this.roomVolume, higher: (CO2Range.higher / 1000) * this.roomVolume };
		this.currentConsumption;

		this.heatPumpState = 0;
		this.rails = [];
		this.railIndex = 0;

		this.averageOffSwitchOverride = false;

		this.ventilationThroughput = 0;

		this.powerSavingMode = false;
		


        this.roomAirMass = this.roomVolume * DensityAir;
        this.roomWallMass = this.roomSurfaces * WallThickness * DensityWall;
        this.roomEquipmentHeatGain = 6.88 * this.roomFloor;
	}

	// Delta???
	ambientWallHeatLoss(delta, currentTemp, outsideTemp) {
		return ((this.roomSurfaces * (currentTemp - outsideTemp)) / HeatResistanceWall) * delta;
	}

	// Delta???
	roomHeatGain(delta, numberOfPeople) {
		if (numberOfPeople > 0) {
			return (this.roomEquipmentHeatGain + HumanHeatGain * numberOfPeople) * delta;
		} else {
			return 0;
		}
	}

	heatPumpUpdate(currentTemperature, tempChange) {
		if (this.rails.length > this.railIndex) {
			let proposedState = this.rails[this.railIndex].heatpump;
			if (!Number.isNaN(proposedState)) {
				this.heatPumpState = proposedState
				return;
			}
		}
		if (this.numberOfPeople > 0) {
			if (currentTemperature < this.tempRangePeople.lower) {
				this.heatPumpState = 1;
			} else if (currentTemperature > this.tempRangePeople.higher) {
				this.heatPumpState = -1;
			} else {
				if (!this.powerSavingMode) {
					let perfectTemp = (this.tempRangePeople.higher + this.tempRangePeople.lower) / 2
					if (currentTemperature > (this.tempRangePeople.higher + this.tempRangePeople.lower) / 2) {
						this.heatPumpState = -((currentTemperature - perfectTemp) / (this.tempRangePeople.higher - perfectTemp));
					} else {
						this.heatPumpState = (currentTemperature - perfectTemp) / (this.tempRangePeople.lower - perfectTemp);
					}
				} else {
					this.heatPumpState = 0;
				}
			}
		} else {
			if (currentTemperature < this.tempRangeNoPeople.lower) {
				this.heatPumpState = 1;
			} else if (currentTemperature > this.tempRangeNoPeople.higher) {
				this.heatPumpState = -1;
			} else {
				if (!this.powerSavingMode) {
					let perfectTemp = (this.tempRangeNoPeople.higher + this.tempRangeNoPeople.lower) / 2
					if (currentTemperature > (this.tempRangeNoPeople.higher + this.tempRangeNoPeople.lower) / 2) {
						this.heatPumpState = -((currentTemperature - perfectTemp) / (this.tempRangeNoPeople.higher - perfectTemp));
					} else {
						this.heatPumpState = (currentTemperature - perfectTemp) / (this.tempRangeNoPeople.lower - perfectTemp);
					}
				} else {
					this.heatPumpState = 0;
					console.log("heatPumpstate = 0")
				}
			}
		}
		let nextTemp = currentTemperature + this.heatPumpState * tempChange;
		let overheating = nextTemp > this.tempRangePeople.higher && this.heatPumpState > 0
		let overcooling = nextTemp < this.tempRangePeople.lower && this.heatPumpState < 0
		let overheatingNoPeople = nextTemp > this.tempRangeNoPeople.higher && this.heatPumpState > 0
		let overcoolingNoPeople = nextTemp < this.tempRangeNoPeople.lower && this.heatPumpState < 0
		if (this.numberOfPeople > 0) {
			if (overheating || overcooling) {
				this.heatPumpState = 0;
			}
		} else {
			if (overheatingNoPeople || overcoolingNoPeople) {
				this.heatPumpState = 0;
			}
		}
	}

	ventilationUpdate() {
		if (this.rails.length > this.railIndex) {
			this.ventilationThroughput = this.rails[this.railIndex].ventilation;
			return;
		}

		if (this.currentCO2 > this.CO2Rangekg.higher) {
			this.ventilationThroughput = VentilationMaxThroughput;
		} else {
			let perfectCo2 = (this.CO2Rangekg.higher + this.CO2Rangekg.lower) / 2
			if (this.currentCO2 > perfectCo2 && !this.powerSavingMode) {
				this.ventilationThroughput = VentilationMaxThroughput * (this.currentCO2 - perfectCo2) / (this.CO2Rangekg.higher - perfectCo2);
			} else {
				this.ventilationThroughput = 0;
			}
		}
	}

	ventilationSupply(delta) {
		if (this.ventilationThroughput == 0) {
			return 0;
		}
		let airMoved = (this.ventilationThroughput / hour * delta);
		let removedCO2Weight = (this.currentCO2 / this.roomVolume) * airMoved;
		let newAirCO2 = outsideCO2Concentration * airMoved;

		return -removedCO2Weight + newAirCO2;

	}

	ambientCo2Loss(delta) {
		return passiveCO2Leak * delta;
	}


	co2Gain(delta) {
		return (CO2Human * delta) * this.numberOfPeople;
	}

	consumption(delta) {
		let heatPumpOutput = Math.abs(this.heatPumpState) * HeatPumpCapacity;
		let heatPumpInput = heatPumpOutput / COPCarnotHeatPump;
		let ventilation = VentilationConsumption * this.ventilationThroughput * delta;
		return (ventilation + heatPumpInput) / 1000;
	}

	update(delta, outsideTemp, numberOfPeople) {
		this.previousTemperature = this.currentTemperature;
		this.previousCO2 = this.currentCO2;
		this.numberOfPeople = numberOfPeople;

		// console.log("---------------------");
		// console.log(this.currentTemperature);

		this.currentCO2 = this.previousCO2 + this.ventilationSupply(delta) + this.ambientCo2Loss(delta) + this.co2Gain(delta);

		this.currentTemperature =
			this.previousTemperature -
			(this.ambientWallHeatLoss(delta, this.previousTemperature, outsideTemp) - this.roomHeatGain(delta, numberOfPeople)) /
			(this.roomAirMass * HeatCapacityAir + this.roomWallMass * HeatCapacityWall);

		//console.log(this.currentTemperature);

		let tempChange = ((1 / (((((this.roomAirMass * HeatCapacityAir + this.roomWallMass * HeatCapacityWall) / 600) / HeatPumpCapacity) * 10) / 60)) / hour) * delta
		this.heatPumpUpdate(this.currentTemperature, tempChange);

		this.currentTemperature = this.currentTemperature + this.heatPumpState * tempChange;
		this.currentConsumption = this.consumption(delta);

		this.ventilationUpdate();
		if (this.rails.length > this.railIndex) {
			this.railIndex++;
		}
		return { heatpump: this.heatPumpState, ventilation: this.ventilationThroughput };
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
				if (simulated.heatPumpState > 0) {
					heatCount++;
				} else if (simulated.heatPumpState < 0) {
					coolCount++;
				}
				if (simulated.ventilationThroughput > 0) {
					ventilation += simulated.ventilationThroughput;
				}
			}
		});
		if (totalConsumption > responseTarget) {
			let testModel = {};

			if (heatCount == 0 && coolCount == 0) {
				testModel = generateStateSequence(this.copy(), data, responseRange, delta, "ventilation");
			} else {
				if (ventilation == 0) {
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
				//console.log(`${index}\t | ${testModel.currentTemperature}\t ${testModel.heatPumpState}\t | ${testModel.currentCO2}\t | ${testModel.ventilationThroughput}`)
				if (index >= responseRange.lower && index <= responseRange.higher) {
					totalConsumption += testModel.consumption(delta);
				}
			});
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
		let newModel = new AdvancedModel(o.currentTemperature, {length: o.wallLength, width: o.wallWidth, height: o.wallHeight}, o.currentCO2, o.tempRangePeople, o.tempRangeNoPeople);
		newModel.numberOfPeople = o.numberOfPeople;
		newModel.heatPumpState = o.heatPumpState;
		newModel.rails = o.rails;
		newModel.railIndex = o.railIndex;
		newModel.currentConsumption = o.currentConsumption;
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
	//console.log(strategies)

	if (strategies.includes("precool")) {
		model.tempRangePeople.higher = model.tempRangePeople.lower;
		model.tempRangeNoPeople.higher = model.tempRangeNoPeople.lower;
	}
	if (strategies.includes("preheat")) {
		model.tempRangePeople.lower = model.tempRangePeople.higher;
		model.tempRangeNoPeople.lower = model.tempRangeNoPeople.higher;
	}
	if (strategies.includes("ventilation")) {
		model.CO2Rangekg.higher = model.CO2Rangekg.lower;
	}

	for (var i = 0; i < responseRange.lower; i++) {
		sequence[i] = model.update(delta, data[i].temperature, data[i].people);
	}
	// reset ranges
	model.tempRangePeople = initialModel.tempRangePeople;
	model.tempRangeNoPeople = initialModel.tempRangeNoPeople;
	model.CO2Rangekg = initialModel.CO2Rangekg;
	model.powerSavingMode = true;
	for (var i = responseRange.lower; i <= responseRange.higher; i++) {
		sequence[i] = model.update(delta, data[i].temperature, data[i].people);
	}

	initialModel.rails = sequence;
	return initialModel;
}
/*
var data = [
	{ temperature: 14, people: 0 },
	{ temperature: 14, people: 0 },
	{ temperature: 14, people: 0 },
	{ temperature: 14, people: 0 },
	{ temperature: 14, people: 0 },
	{ temperature: 14, people: 0 },
	{ temperature: 14, people: 0 },
	{ temperature: 14, people: 0 },
	{ temperature: 14, people: 0 },
	{ temperature: 14, people: 0 },
	{ temperature: 14, people: 0 },
	{ temperature: 14, people: 0 },
	{ temperature: 14, people: 0 },
	{ temperature: 14, people: 0 },
	{ temperature: 14, people: 0 },
	{ temperature: 14, people: 0 },
	{ temperature: 14, people: 0 },
	{ temperature: 14, people: 0 },
	{ temperature: 14, people: 0 },
	{ temperature: 14, people: 0 },
	{ temperature: 14, people: 0 },
	{ temperature: 14, people: 0 },
	{ temperature: 14, people: 0 },
	{ temperature: 14, people: 0 }
];

//TempPeopleCO2Model
let co2Model = new AdvancedModel(18, 50, 0, { lower: 20, higher: 25 }, { lower: 25, higher: 25 });
let result = co2Model.predict(3600, data, { lower: 0, higher: 0 }, 10000);
co2Model.rails = result.stateSequence;
console.log(result);

let hourNumber = 0;
let showData = [];
data.forEach(o => {
	let prevConsumption = co2Model.consumption(3600);
	co2Model.update(3600, o.temperature, o.people);
   // showData.push({ time: o.time, consumption: prevConsumption, co2: co2Model.currentCO2, temperature: co2Model.currentTemperature });
    console.log(`Degrees C: ${co2Model.currentTemperature}`);
});*/


module.exports = {
	AdvancedModel: AdvancedModel
}
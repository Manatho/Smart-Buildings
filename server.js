const express = require("express");
const app = express();
const path = require("path");

const port = process.env.PORT;
const data = require("./public/weatherdata.json");

app.use("/public", express.static(__dirname + "/public"));

// /data?day=yyyy/mm/dd&profile=[profile]
app.get("/data", (req, res) => {
	let day = new Date(req.query.day);
	day.setHours(1); //Convert to UTC

	let profile = req.query.profile;
	let people = getPeopleOfTheDay(profile, day);
	
	day = day.getTime() / 1000; //Convert to epoch in seconds
	
	//Get the weather data for the day
	let dataSlice;
	for (let i = 0; i < data.length; i++) {
		const dp = data[i];
		if (dp.time < day && dp.time > day - 600) {
			dataSlice = data.slice(i, i+144);
			break;
		}
	}

	//dataslice was never set
	if(dataSlice == null){
		res.send("Error, date out of bound");
		return;
	}

	//Create dataformat for BMS: [time](temperature){people}
	let response = "";
	dataSlice.forEach((element, i) => {
		let time = new Date(element.time*1000);
		time.setHours(time.getHours()-1); // Convert to UTC
		time.setMinutes(time.getMinutes()+9); // Minute Offset to align with 00:00
		let timeString = time.getHours() + ":" + time.getMinutes();

		response += `[${timeString}](${element.temperature.toFixed(2)}){${people[i]}}\n`
	});
	res.send(response);
});

const samplePrHour = 6;
const weekDay = {"0": "Sunday", "1":"Monday", "2":"Tuesday", "3":"Wednesday", "4":"Thursday", "5":"Friday", "6":"Saturday"}
function getPeopleOfTheDay(profile, day){
	let people = new Array(144) // update every 10 minutes
	
	for (let i = 0; i < people.length; i++) {
		if(profile == "office"){
			if(i < 8*samplePrHour || i > 16*samplePrHour || weekDay[day.getDay()] == "Saturday" || weekDay[day.getDay()] == "Sunday"){ 
				people[i] = 0;
			} else {
				people[i] = 1;
			}
		} else {
			if(i < 8*samplePrHour || i > 16*samplePrHour || weekDay[day.getDay()] == "Saturday" || weekDay[day.getDay()] == "Sunday"){ 
				people[i] = 0;
			} else {
				people[i] = 10;
			}
		}
	}
	return people;
}



app.post("/predict", (req, res) => {
	// BMS: the data of the day + timestep
	// The DemandResponse data: Range and value
	// Current state: temp, co2, heater state, ventilator state, roomsize, comfor ranges (people, no people), co2 range
	//... EVERYHTING
});

app.post("/currentState/:id", (req, res) => {
	res.set({ "content-type": "text/plain" })
	console.log(req.params.id);
	res.send(req.params);
});

app.get("/", (req, res) => {
	res.sendFile(path.join(__dirname, "visualizer/index.html"));
});

if (port !== undefined) {
	app.listen(port, () => console.log(`Example app listening on port ${port}!`));
} else {
	app.listen(3000, () => console.log(`Example app listening on port ${3000}!`));
}

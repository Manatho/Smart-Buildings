const express = require("express");
const app = express();
const path = require("path");

const port = process.env.PORT;
const data = require("./public/weatherdata.json");

app.use("/public", express.static(__dirname + "/public"));

// /data?day=1557846833
app.get("/data", (req, res) => {
	let day = new Date(req.query.day*1000);
	day.setHours(2);
	day.setMinutes(0);
	day.setSeconds(0);
	day.setMilliseconds(0);
	day = day.getTime() / 1000;
	
	let profile = req.query.profile;
	let people = 0;
	if(profile == "office"){
		people = 5;
	} else {
		people = 1;
	}

	let dataSlice;
	for (let i = 0; i < data.length; i++) {
		const dp = data[i];
		if (dp.time < day && dp.time > day - 600) {
			dataSlice = data.slice(i, i+145);
			break;
		}
	}
	let response = "";
	dataSlice.forEach(element => {
		response += `[${element.time}]{${element.temperature.toFixed(2)}}(${people})\n`
	});
	res.send(response);
    console.log("---------------");
});

app.post("/predict", (req, res) => {
	// BMS: the data of the day + timestep
	// The DemandResponse data: Range and value
	// Current state: temp, co2, heater state, ventilator state, roomsize, comfor ranges (people, no people), co2 range
	//... EVERYHTING
});

app.post("/currentState", (req, res) => {
	// Log the state
});

app.get("/", (req, res) => {
	res.sendFile(path.join(__dirname, "visualizer/index.html"));
});

if (port !== undefined) {
	app.listen(port, () => console.log(`Example app listening on port ${port}!`));
} else {
	app.listen(3000, () => console.log(`Example app listening on port ${3000}!`));
}

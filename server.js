const express = require("express");
const app = express();
const path = require("path");
const fs = require('fs')

const port = process.env.PORT;
const data = require("./public/weatherdata.json");

//On server start it will update last predicted
fs.copyFileSync("./DummyData/lastPredict.json", "./public/predicted.json");

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
			dataSlice = data.slice(i, i + 144);
			break;
		}
	}

	//dataslice was never set
	if (dataSlice == null) {
		res.send("Error, date out of bound");
		return;
	}

	//Create dataformat for BMS: [time](temperature){people}
	let response = "";
	dataSlice.forEach((element, i) => {
		let time = new Date(element.time * 1000);
		time.setHours(time.getHours() - 1); // Convert to UTC
		time.setMinutes(time.getMinutes() + 9); // Minute Offset to align with 00:00
		let timeString = time.getHours() + ":" + time.getMinutes();

		response += `[${timeString}](${element.temperature.toFixed(2)}){${people[i]}}\n`;
	});
	res.send(response);
});

const samplePrHour = 6;
const weekDay = { "0": "Sunday", "1": "Monday", "2": "Tuesday", "3": "Wednesday", "4": "Thursday", "5": "Friday", "6": "Saturday" };
function getPeopleOfTheDay(profile, day) {
	let people = new Array(144); // update every 10 minutes

	for (let i = 0; i < people.length; i++) {
		if (profile == "office") {
			if (i < 8 * samplePrHour || i > 16 * samplePrHour || weekDay[day.getDay()] == "Saturday" || weekDay[day.getDay()] == "Sunday") {
				people[i] = 0;
			} else {
				people[i] = 1;
			}
		} else {
			if (i < 8 * samplePrHour || i > 16 * samplePrHour || weekDay[day.getDay()] == "Saturday" || weekDay[day.getDay()] == "Sunday") {
				people[i] = 0;
			} else {
				people[i] = 10;
			}
		}
	}
	return people;
}

app.get("/predict", (req, res) => {
	let validationResult = validQuery(req.query);
	if (!validationResult.valid) {
		res.send("missing param: " + validationResult.failedParam);
		return;
	}

	let predict = {
		timestep: Number.parseInt(req.query.timestep),
		data: []
	};
	let bmsData = req.query.data;
	let dataPoints = bmsData.split(",");
	let currentTime = 0;

	dataPoints.forEach(dp => {
		let split = dp.split(";");
		predict.data.push({
			time: currentTime,
			temperature: split[0],
			people: split[1]
		});
		currentTime += predict.timestep;
	});

	predict.startTemp = Number.parseInt(req.query.temperature);
	predict.roomsize = Number.parseInt(req.query.roomsize);
	predict.startCO2 = Number.parseInt(req.query.co2);
	predict.comfortRange = parseRange(req.query.comfortRange);
	predict.emptyRange = parseRange(req.query.emptyRange);
	predict.demandRange = parseRange(req.query.demandRange);
	predict.demandPower = Number.parseInt(req.query.demandPower);

	fs.writeFile("./public/predicted.json", JSON.stringify(predict), err => {
		console.log(err);
	});

	res.send(predict);
});

app.post("/currentState", (req, res) => {
	res.set({ "content-type": "text/plain" })
	// time
	let year = req.query.year;
	let month = req.query.month;
	let date = req.query.date;
	let hour = req.query.hour;
	let minute = req.query.minute;
	let sec = req.query.second;
	let time = Math.floor(new Date(year, month, date, hour, minute, sec).getTime() / 1000.0);
	// temp
	let temperature = req.query.temperature;
	// co2
	let co2 = req.query.co2;
	// people
	let people = req.query.people;

	fs.readFile('./public/livedata.json', 'utf-8', function (err, data) {
		if (err) throw err

		let arrayOfObjects = JSON.parse(data)
		arrayOfObjects.push({
			time: time,
			temperature: temperature,
			co2: co2,
			people: people
		})
		console.log(arrayOfObjects)

		fs.writeFile('./public/livedata.json', JSON.stringify(arrayOfObjects), 'utf-8', function (err) {
			if (err) throw err
			console.log('Done!');
		})
	})

	console.log(`time:${time}\ntemperature:${temperature}\nco2:${co2}\npeople:${people}`);
	res.status(200);
})

function validQuery(query) {
	let required = ["temperature", "roomsize", "co2", "comfortRange", "emptyRange", "demandRange", "demandPower", "data", "timestep"];
	let failed = [];

	required.forEach(key => {
		if(!query.hasOwnProperty(key)){
			failed.push(key);
		}
	});


	return { valid: failed.length == 0, failedParam: failed };
}

function parseRange(range) {
	let split = range.split(":");
	return { lower: Number.parseInt(split[0]), higher: Number.parseInt(split[1]) };
}


app.get("/", (req, res) => {
	res.sendFile(path.join(__dirname, "visualizer/index.html"));
});

if (port !== undefined) {
	app.listen(port, () => console.log(`Example app listening on port ${port}!`));
} else {
	app.listen(3000, () => console.log(`Example app listening on port ${3000}!`));
}

const express  = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const {WebhookClient} = require('dialogflow-fulfillment');
const {Text, Card, Image, Suggestion, Payload} = require('dialogflow-fulfillment');

process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements

const Equipment = require('../models/equipment');

const apiRouter = express.Router();

apiRouter.use(bodyParser.json());

// Wikipedia link and image URLs
const FMImageUrl = 'https://marshallpropertyconstruction.co.uk/wp-content/uploads/2017/01/35048060-d9b5f732-fb93-11e7-81bd-5a50890b3112.jpg';
const FMUrl = 'https://fms-ws.herokuapp.com/';
const ErrorImageUrl = 'https://braziliex.com/img/erro1.png';
const ErrorImage = new Image(ErrorImageUrl);

function welcome(agent) {
    agent.add('Welcome to the Facility Management System!');
    agent.add(new Card({
        title: 'Facility Management Chat',
        imageUrl: FMImageUrl,
        text: 'Your wish is my command! 😱',
        buttonText: 'Facility Management Page', 
        buttonUrl: FMUrl
      })
    );
    agent.add('I have all information regarding the equipment in this building! What would you like to know?');
	agent.add('1. Equipment Status e.g. status of FCUs at La Cala?');
	agent.add('2. Command Equipment e.g. Start FCU_L1_01');
	agent.add('3. Schedule Equipment e.g. Set FCUs at Let\'s Eat to start from 8:30a.m. to 10p.m. daily');
	agent.add('4. System Health Check e.g. Any alarms at Let\'s Eat?');
	agent.add('5. Adjust Temperature e.g. Adjust the thermostat at Let\'s Eat to 23C');
}

function findEquipment(eqpname, equiptParam) {
	Equipment.findOne({name: eqpname}, function(err, equip){
		console.log("Test: " + equip.name + "\'s" + equiptParam + " is " + equip.humidity);
		console.log(equip);
		return equip;
   });
}

function dialogflowHanlderWithRequest(agent) {
	return new Promise((resolve, reject) => {
		agent.add("dialogflowHanlderWithRequest test");
		resolve();
	});
};

function checkEquipment(agent) {
		var equiptVal, equiptUnit, respString = '';
		var equips = [];
		var eqp;

		// Get parameters from Dialogflow
		const equiptName = agent.parameters.EqptName.toUpperCase();
		const equiptLoc = agent.parameters.EqptLocation.toUpperCase();
		const equiptParam = agent.parameters.EqptParam;

		if(equiptName != '') {
			console.log(`User requested for ${equiptName}'s ${equiptParam}`);
			console.log("Search Equipment Status By Name");

			return Equipment.findOne({name: equiptName})
				.then((equipment) => {
					if(equipment != null) {
						switch (equiptParam) {
							case "temperature":
								equiptVal = equipment.temperature.toString();
								equiptUnit = '°C';
								break;
							case "humidity":
								equiptVal = equipment.humidity.toString();
								equiptUnit = '%';
								break;
							case "status":
								equiptVal = equipment.status.toString();
								equiptUnit = '';
								break;
							case "schedule":
								equiptVal = "from " + equipment.schedule[0].StartTime + "hrs to " + equipment.schedule[0].StopTime + "hrs " + equipment.schedule[0].Frequency;
								equiptUnit = '';
								break;
							default:
								equiptVal = "";
								equiptUnit = '';
						}
					} else {
						respString = "Equipment " + equiptName + " is not found";
					}
				})
				
				.then((result) => {
					console.log(equiptName + "'s " + equiptParam + " is " + equiptVal + equiptUnit);
					if(respString != "") {
						//return agent.add(respString);
						agent.add(new Image(ErrorImage));
						agent.add(respString);
					} else {
						//Sent the context to store the parameter information
						agent.setContext({
							name: equiptParam,
							lifespan: 1,
							parameters:{'Value': equiptVal, 'Unit': equiptUnit}
						});
						return agent.add(equiptName + "'s " + equiptParam + " is " + equiptVal + equiptUnit);
					}	
				})

				.catch((err) => {
					console.log(err);
					return Promise.reject(err);
				});
		} else if(equiptLoc != '') {
			console.log(`User requested for ${equiptLoc}'s ${equiptParam}`);
			console.log("Search Equipment Status By Location");
			return Equipment.find({location: equiptLoc})
				.then((equipment) => {
					if(equipment.length != 0) {
						for(var i = (equipment.length - 1); i >= 0; i--) {
							console.log(equipment[i].name);
							switch (equiptParam) {
								case "temperature":
									equiptVal = equipment[i].temperature.toString();
									equiptUnit = '°C';
									break;
								case "humidity":
									equiptVal = equipment[i].humidity.toString();
									equiptUnit = '%';
									break;
								case "status":
									equiptVal = equipment[i].status;
									equiptUnit = '';
									break;
								case "schedule":
									equiptVal = "from " + equipment[i].schedule[0].StartTime + "hrs to " + equipment[i].schedule[0].StopTime + "hrs " + equipment[i].schedule[0].Frequency;
									equiptUnit = '';
									break;
								default:
									equiptVal = "";
									equiptUnit = '';
							}
							equips[i] = equipment[i].name + "\'s " + equiptParam + ' is ' + equiptVal + equiptUnit;
						}
					} else {
						respString = "Location " + equiptLoc + " not found";
					}
				})
				
				.then((result) => {
					if(respString != "") {
						//return agent.add(respString);
						agent.add(new Image(ErrorImage));
						agent.add(respString);
					} else {
						console.log(equips[i]);
						for(var i = (equips.length - 1); i >= 0; i--) {
							agent.add(equips[i]);
						}
					}
				})

				.catch((err) => {
					console.log(err);
					return Promise.reject(err);
				});
		}
}


function controlEquipment(agent) {
	var equiptVal, equiptUnit, respString;
	var equips = [];
	var eqp;

	// Get parameters from Dialogflow
	const equiptName = agent.parameters.EqptName.toUpperCase();
	const equiptLoc = agent.parameters.EqptLocation.toUpperCase();
	const equiptCommand = agent.parameters.EqptCommand;
	var equiptStatus = equiptCommand == 'Start' ? 'Running' : 'Stopped' ;

	if(equiptName != '') {
		console.log(`User requested to ${equiptCommand} ${equiptName}`);
		console.log("Control Equipment By Name");

		return Equipment.findOneAndUpdate({name: equiptName}, {$set: {command: equiptCommand, "status" : equiptStatus}}, {upsert: false})
			.then((result) => {
				console.log("Update Equipment Result: " + result);
				if(result != null) {
					console.log(equiptName + " commanded to " + equiptCommand);
					return agent.add(equiptName + " command to " + equiptCommand + " is successful");
				} else {
					//return agent.add("Equipment " + equiptName + " not found");
					agent.add(new Image(ErrorImage));
					agent.add("Equipment " + equiptName + " not found");
				}
			})

			.catch((err) => {
				console.log(err);
				return Promise.reject(err);
			});
	} else if(equiptLoc != '') {
		console.log(`User requested to ${equiptCommand} equipment at ${equiptLoc}`);
		console.log("Control Equipment By Location");
		return Equipment.updateMany(
					{ location: equiptLoc },
					{ $set: { "command" : equiptCommand, "status" : equiptStatus } })
			.then((result) => {
				console.log("Update Status: "+ result);
				console.log("Updated " + JSON.parse(JSON.stringify(result)).n + " Equipment at Location " + equiptLoc);
				if(JSON.parse(JSON.stringify(result)).n != 0) {
					console.log("Equipment at " + equiptLoc + " commanded to " + equiptCommand);
					return agent.add("Equipment at " + equiptLoc + " commanded to " + equiptCommand + " successfully");	
				} else {
					//return agent.add("Location " + equiptLoc + " not found");
					agent.add(new Image(ErrorImage));
					agent.add("Location " + equiptLoc + " not found");
				}
			})

			.catch((err) => {
				console.log(err);
				return Promise.reject(err);
			});
	}
}

String.prototype.splice = function(idx, rem, str) {
    return this.slice(0, idx) + str + this.slice(idx + Math.abs(rem));
};

function scheduleEquipment(agent) {
	//TODO
	var equiptVal, equiptUnit, respString;
	var equips = [];
	var eqp;

	// Get parameters from Dialogflow
	const equiptName = agent.parameters.EqptName.toUpperCase();
	const equiptLoc = agent.parameters.EqptLocation.toUpperCase();
	var equiptSchStartTime = agent.parameters.SchStartTime.split('T')[1].split('+')[0];
	var equiptSchStopTime = agent.parameters.SchStopTime.split('T')[1].split('+')[0];
	const equiptSchFrequency = agent.parameters.SchFreq;

	equiptSchStartTime = equiptSchStartTime.substring(0, equiptSchStartTime.length-3).splice(2, 1, ":");
	equiptSchStopTime = equiptSchStopTime.substring(0, equiptSchStopTime.length-3).splice(2, 1, ":");

	if(equiptName != '') {
		console.log(`User requested to schedule ${equiptName} to run from ${equiptSchStartTime} to ${equiptSchStopTime} ${equiptSchFrequency}`);
		console.log("Schedule Equipment By Name");

		return Equipment.findOneAndUpdate({name: equiptName}, 
										{$set: { "schedule": 
													[{
														"StartTime": equiptSchStartTime,
												 	 	"StopTime": equiptSchStopTime,
														"Frequency": equiptSchFrequency 
													}]}}, {upsert: false})
			.then((result) => {
				console.log("Update Equipment Schedule Result: " + result);
				if(result != null) {
					console.log(equiptName + " scheduled to run from " + equiptSchStartTime + " to " + equiptSchStopTime + " " + equiptSchFrequency);
					return agent.add(equiptName + " scheduled to run from " + equiptSchStartTime + " to " + equiptSchStopTime + " " + equiptSchFrequency + " is successful");
				} else {
					//return agent.add("Equipment " + equiptName + " not found");
					agent.add(new Image(ErrorImage));
					agent.add("Equipment " + equiptName + " not found");
				}
			})

			.catch((err) => {
				console.log(err);
				return Promise.reject(err);
			});
	} else if(equiptLoc != '') {
		console.log(`User requested to schedule equipment at ${equiptLoc} to run from ${equiptSchStartTime} to ${equiptSchStopTime} ${equiptSchFrequency}`);
		console.log("Schedule Equipment By Location");
		return Equipment.updateMany(
					{ location: equiptLoc },
					{$set: { "schedule": 
								[{
									"StartTime": equiptSchStartTime,
									"StopTime": equiptSchStopTime,
									"Frequency": equiptSchFrequency 
								}]}}, {upsert: false})
			.then((result) => {
				console.log("Updated " + JSON.parse(JSON.stringify(result)).n + " Equipment at Location " + equiptLoc);
				if(JSON.parse(JSON.stringify(result)).n != 0) {
					console.log("Equipment at " + equiptLoc + " scheduled to run from " + equiptSchStartTime + " to " + equiptSchStopTime + " " + equiptSchFrequency);
					return agent.add("Equipment at " + equiptLoc + " scheduled to run from " + equiptSchStartTime + " to " + equiptSchStopTime + " " + equiptSchFrequency + " successfully");	
				} else {
					//return agent.add("Location " + equiptLoc + " not found");
					agent.add(new Image(ErrorImage));
					agent.add("Location " + equiptLoc + " not found");
				}
			})

			.catch((err) => {
				console.log(err);
				return Promise.reject(err);
			});
	}
}

function checkSystemHealth(agent) {
	var equiptAlmStat = '', respString = '', equiptAlm = '', equiptAlmDesc = '';
	var equips = [];

	// Get parameters from Dialogflow
	const equiptName = agent.parameters.EqptName.toUpperCase();
	const equiptLoc = agent.parameters.EqptLocation.toUpperCase();

	if(equiptName != '') {
		console.log(`User requested for ${equiptName}'s health status`);
		console.log("Search Equipment Health Status By Name");

		return Equipment.findOne({name: equiptName})
			.then((equipment) => {
				if(equipment != null) {
					equiptAlm = equipment.Alarm;
					equiptAlmDesc = equipment.AlarmDesc;
					if(equiptAlm) {
						equiptAlmStat = equiptName + ": " + equiptAlmDesc;
					} else {
						equiptAlmStat = equiptName + " has no current issues";
					}
				} else {
					respString = "Equipment " + equiptName + " is not found";
				}
			})
			
			.then((result) => {
				if(respString != "") {
					//return agent.add(respString);
					agent.add(new Image(ErrorImage));
					agent.add(respString);
				} else {
					//Sent the context to store the parameter information
					return agent.add(equiptAlmStat);
				}	
			})

			.catch((err) => {
				console.log(err);
				return Promise.reject(err);
			});
	} else if(equiptLoc != '') {
		console.log(`User requested for ${equiptLoc}'s health status`);
		console.log("Search Equipment Health Status By Location");

		return Equipment.find({location: equiptLoc})
			.then((equipment) => {
				if(equipment.length != 0) {
					for(var i = (equipment.length - 1); i >= 0; i--) {
						if(equipment[i].Alarm == true) {
							equips[i] = equipment[i].name + ': ' + equipment[i].AlarmDesc;
						}
					}
				} else {
					respString = "Location " + equiptLoc + " not found";
				}
			})
			
			.then((result) => {
				if(respString != "") {
					//return agent.add(respString);
					agent.add(new Image(ErrorImage));
					agent.add(respString);
				} else {
					if(equips.length != 0) {
						for(var i = (equips.length - 1); i >= 0; i--) {
							if(equips[i] != null) {
								agent.add(equips[i]);
							}
						}
					} else {
						agent.add( "Location " + equiptLoc + " has no current issues");
					}
				}
			})

			.catch((err) => {
				console.log(err);
				return Promise.reject(err);
			});
	}		
}

function adjustThermostat(agent) {
	var equiptVal, equiptUnit, respString;
	var equips = [];
	var eqp;

	// Get parameters from Dialogflow
	const equiptName = agent.parameters.EqptName.toUpperCase();
	const equiptLoc = agent.parameters.EqptLocation.toUpperCase();
	const equiptSetTemp = JSON.parse(JSON.stringify(agent.parameters.SetTemp)).amount.toString();

	if(equiptName != '') {
		console.log(`User requested to set ${equiptName}'s thermostat setting to ${equiptSetTemp} °C`);
		console.log("Thermostat Adjustment By Name");

		return Equipment.findOneAndUpdate({name: equiptName}, {$set: {"temperature": equiptSetTemp}}, {upsert: false})
			.then((result) => {
				console.log("Thermostat Adjustment for Equipment Result: " + result);
				if(result != null) {
					console.log(equiptName + " 's thermostat setting set to " + equiptSetTemp + "°C");
					return agent.add(equiptName + " 's thermostat setting set to " + equiptSetTemp + "°C successfully");
				} else {
					//return agent.add("Equipment " + equiptName + " not found");
					agent.add(new Image(ErrorImage));
					agent.add("Equipment " + equiptName + " not found");
				}
			})

			.catch((err) => {
				console.log(err);
				return Promise.reject(err);
			});
	} else if(equiptLoc != '') {
		console.log(`User requested to set thermostat setting at ${equiptLoc} to ${equiptSetTemp} °C`);
		console.log("Thermostat Adjustment By Location");
		return Equipment.updateMany(
					{ location: equiptLoc },
					{ $set: { "temperature" : equiptSetTemp } })
			.then((result) => {
				console.log("Updated " + JSON.parse(JSON.stringify(result)).n + "Equipment at Location " + equiptLoc);
				if(JSON.parse(JSON.stringify(result)).n != 0) {
					console.log("Thermostat setting for Equipment at " + equiptLoc + " set to " + equiptSetTemp + "°C");
					return agent.add("Thermostat setting for Equipment at " + equiptLoc + " set to " + equiptSetTemp + "°C successfully");	
				} else {
					//return agent.add("Location " + equiptLoc + " not found");
					agent.add(new Image(ErrorImage));
					agent.add("Location " + equiptLoc + " not found");
				}
			})

			.catch((err) => {
				console.log(err);
				return Promise.reject(err);
			});
	}	
}

apiRouter.route('/')
.get( (req, res, next) => {
	Equipment.find({})
		.then((equipment) => {
			res.statusCode = 200
			res.setHeader('Content-Type', 'application/json');
			res.setHeader('Access-Control-Allow-Origin', '*');
			res.json(equipment);
	}, (err) => next(err))
	.catch((err) => next(err));
})

.post( (req, res, next) => {

	const agent = new WebhookClient({ request: req, response: res });
	//console.log('Dialogflow Request headers: ' + JSON.stringify(req.headers));
	//console.log('Dialogflow Request body: ' + JSON.stringify(req.body));

	let intentMap = new Map(); // Map functions to Dialogflow intent names
	intentMap.set('Default Welcome Intent', welcome);
	intentMap.set('EquipmentStatusCheck', checkEquipment);
	intentMap.set('EquipmentControl', controlEquipment);
	intentMap.set('EquipmentScheduling', scheduleEquipment);
	intentMap.set('SystemHealthCheck', checkSystemHealth);
	intentMap.set('ThermostatAdjustment', adjustThermostat);
	agent.handleRequest(intentMap);
})

.put( (req, res, next) => {
	res.statusCode = 403;
	res.end('PUT operation not supported on /equipment');
})

.delete( (req, res, next) => {
	Equipment.remove({})
		.then((resp) => {
			res.statusCode = 200
			res.setHeader('Content-Type', 'application/json');
			res.setHeader('Access-Control-Allow-Origin', '*');
			res.json(resp);
	}, (err) => next(err))
	.catch((err) => next(err));
});

apiRouter.route('/:equipmentId')
.get( (req, res, next) => {
	Equipment.findById(req.params.equipmentId)
		.then((equipment) => {
			res.statusCode = 200
			res.setHeader('Content-Type', 'application/json');
			res.setHeader('Access-Control-Allow-Origin', '*');
			res.json(equipment);
	}, (err) => next(err))
	.catch((err) => next(err));
})

.post( (req, res, next) => {
	res.statusCode = 403;
	res.end('POST operation not supported on /equipment/'
	+ req.params.equipmentId);
})

.put( (req, res, next) => {
	Equipment.findByIdAndUpdate(req.params.equipmentId, {
		$set: req.body
	}, {new:true})
		.then((equipment) => {
			res.statusCode = 200
			res.setHeader('Content-Type', 'application/json');
			res.setHeader('Access-Control-Allow-Origin', '*');
			res.json(equipment);
	}, (err) => next(err))
	.catch((err) => next(err));		
})

.delete( (req, res, next) => {
	Equipment.findByIdAndRemove(req.params.EquipmentId)
		.then((resp) => {
			res.statusCode = 200
			res.setHeader('Content-Type', 'application/json');
			res.setHeader('Access-Control-Allow-Origin', '*');
			res.json(resp);
	}, (err) => next(err))
	.catch((err) => next(err));
});

apiRouter.route('/:equipmentId/schedule')
.get( (req, res, next) => {
	Equipment.findById(req.params.equipmentId)
		.then((equipment) => {
			if(equipment != null) {
				res.statusCode = 200
				res.setHeader('Content-Type', 'application/json');
				res.setHeader('Access-Control-Allow-Origin', '*');
				res.json(equipment.schedule);				
			}
			else {
				err = new Error('Equipment ' + req.params.equipmentId + ' not found');
				err.status = 404;
				return next(err);
			}
	}, (err) => next(err))
	.catch((err) => next(err));
})

.post( (req, res, next) => {
	Equipment.findById(req.params.equipmentId)
		.then((equipment) => {
			if(equipment != null) {
				equipment.schedule.push(req.body);
				equipment.save()
					.then((equipment) => {
						res.statusCode = 200
						res.setHeader('Content-Type', 'application/json');
						res.json(equipment);
					})									
			}
			else {
				err = new Error('Equipment ' + req.params.equipmentId + ' not found');
				err.status = 404;
				return next(err);
			}
	}, (err) => next(err))
	.catch((err) => next(err));
})

.put( (req, res, next) => {
	res.statusCode = 403;
	res.end('PUT operation not supported on /equipment/'
		+ req.params.equipmentId + '/schedule');
})

.delete( (req, res, next) => {
	Equipment.findById(req.params.equipmentId)
		.then((equipment) => {
			if(equipment != null) {
				for(var i = (equipment.schedule.length - 1); i >= 0; i--) {
					equipment.schedule.id(equipment.schedule[i]._id).remove();
				}
				equipment.save()
					.then((equipment) => {
						res.statusCode = 200
						res.setHeader('Content-Type', 'application/json');
						res.setHeader('Access-Control-Allow-Origin', '*');
						res.json(equipment);
					}, (err) => next(err));
			}
			else {
				err = new Error('Equipment ' + req.params.equipmentId + ' not found');
				err.status = 404;
				return next(err);
			}
	}, (err) => next(err))
	.catch((err) => next(err));
});

apiRouter.route('/:equipmentId/schedule/:scheduleId')
.get( (req, res, next) => {
	Equipment.findById(req.params.equipmentId)
		.then((equipment) => {
			if(equipment != null && equipment.schedule.id(req.params.scheduleId) != null) {
				res.statusCode = 200
				res.setHeader('Content-Type', 'application/json');
				res.json(equipment.schedule.id(req.params.scheduleId));				
			}
			else if(equipment == null) {
				err = new Error('Equipment ' + req.params.equipmentId + ' not found');
				err.status = 404;
				return next(err);
			}
			else {
				err = new Error('Schedule ' + req.params.scheduleId + ' not found');
				err.status = 404;
				return next(err);				
			}
	}, (err) => next(err))
	.catch((err) => next(err));
})

.post( (req, res, next) => {
	res.statusCode = 403;
	res.end('POST operation not supported on /equipment/' + req.params.equipmentId
	+ '/schedule/' + req.params.scheduleId);
})

.put( (req, res, next) => {
	Equipment.findById(req.params.equipmentId)
		.then((equipment) => {
			if(equipment != null && equipment.schedule.id(req.params.scheduleId) != null) {
				if(req.body.StartTime) {
					equipment.schedule.id(req.params.scheduleId).StartTime = req.body.StartTime
				}
				if(req.body.StopTime) {
					equipment.schedule.id(req.params.scheduleId).StopTime = req.body.StopTime
				}
				if(req.body.Frequency) {
					equipment.schedule.id(req.params.scheduleId).Frequency = req.body.Frequency
				}
				equipment.save()
					.then((equipment) => {
						res.statusCode = 200
						res.setHeader('Content-Type', 'application/json');
						res.json(equipment);
					})				
			}
			else if(equipment == null) {
				err = new Error('Equipment ' + req.params.equipmentId + ' not found');
				err.status = 404;
				return next(err);
			}
			else {
				err = new Error('Schedule ' + req.params.scheduleId + ' not found');
				err.status = 404;
				return next(err);				
			}	
	}, (err) => next(err))
	.catch((err) => next(err));			
})

.delete( (req, res, next) => {
	Equipment.findById(req.params.equipmentId)
		.then((equipment) => {
			if(equipment != null && equipment.schedule.id(req.params.scheduleId) != null) {
				equipment.schedule.id(req.params.scheduleId).remove();
				equipment.save()
					.then((equipment) => {
						res.statusCode = 200
						res.setHeader('Content-Type', 'application/json');
						res.setHeader('Access-Control-Allow-Origin', '*');
						res.json(equipment);
					}, (err) => next(err));
			}
			else if(equipment == null) {
				err = new Error('Equipment ' + req.params.equipmentId + ' not found');
				err.status = 404;
				return next(err);
			}
			else {
				err = new Error('Schedule ' + req.params.scheduleId + ' not found');
				err.status = 404;
				return next(err);				
			}	
	}, (err) => next(err))
	.catch((err) => next(err));
});

module.exports = apiRouter;
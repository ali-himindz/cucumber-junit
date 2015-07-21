var xml = require('xml');

/**
 * Convert a step from Cucumber.JS into <testcase> XML
 * 
 * @method convertStep
 * @param {Object}
 *            stepJson Step output from Cucumber.JS
 * @param {Object}
 *            scenarioJson Scenario output from Cucumber.JS
 * @return {Array} Array of elements for an XML element <testcase>
 */
function convertStep(stepJson, scenarioJson) {
	var tags = " ";
        if (scenarioJson.tags){
                scenarioJson.tags.forEach(function(tag) {
                 tags = tag.name + " ";
                });
        }

	var stepOutput = [ {
		_attr : {
			name : stepJson.keyword + stepJson.name,
			classname : tags+scenarioJson.id
		}
	} ];

	if (stepJson.result.duration) {
		// Convert from nanosecond to seconds
		stepOutput[0]._attr.time = stepJson.result.duration / 1000000000;
	}
	var path = require('path') ;
	var attachment = "[[ATTACHMENT|";
	if ('embeddings' in stepJson) {

		for ( var i = 0; i < stepJson.embeddings.length; i++) {
			var buf = new Buffer(stepJson.embeddings[i].data, 'base64');
			var filename=i+"_"+scenarioJson.id+".png";
			var filepath=path.resolve("./"+filename);
			var fs = require('fs');
			var attachmentpath=attachment+filepath+"]]";
			fs.writeFile(filename, buf, function(err) {

			});
			stepOutput.push({
				'system-out' : [ attachmentpath ]
			});
		}
	}
	switch (stepJson.result.status) {
	case 'passed':
		break;
	case 'failed':
		stepOutput.push({
			error : [ {
				_attr : {
					message : stepJson.result.error_message.split("\n").shift()
				}
			}, stepJson.result.error_message ]
		});
		break;
	case 'skipped':
	case 'undefined':
		stepOutput.push({
			skipped : [ {
				_attr : {
					message : ""
				}
			} ]
		});
		break;
	}
	return stepOutput;
}

/**
 * Convert a scenario from Cucumber.JS into an XML element <testsuite>
 * 
 * @method convertScenario
 * @param {Object}
 *            scenarioJson Scenario output from Cucumber.JS
 * @return {Array} Array of elements for an XML element <testsuite>
 */
function convertScenario(scenarioJson) {
	var tags = " ";
        if (scenarioJson.tags){
	        scenarioJson.tags.forEach(function(tag) {
       	         tags = tag.name + " ";
        	});
        }

	var scenarioOutput = [ {
		_attr : {
			name : tags+scenarioJson.id,
			tests : (scenarioJson.steps) ? scenarioJson.steps.length : 0,
			failures : 0,
			skipped : 0
		}
	} ];
	if (scenarioJson.steps) {
		scenarioJson.steps.forEach(function(stepJson) {
			var testcase = convertStep(stepJson, scenarioJson);
			// Check for errors and increment the failure rate
			if (testcase[1] && testcase[1].error) {
				scenarioOutput[0]._attr.failures += 1;
			}
			if (testcase[1] && testcase[1].skipped) {
				scenarioOutput[0]._attr.skipped += 1;
			}
			scenarioOutput.push({
				testcase : testcase
			});
		});
	}

	return {
		testsuite : scenarioOutput
	};
}

/**
 * [convertFeature description]
 * 
 * @method convertFeature
 * @param {[type]}
 *            featureJson [description]
 * @return {[type]} [description]
 */
function convertFeature(featureJson) {
	var elements = featureJson.elements || [];
	return elements.filter(function(scenarioJson) {
		return (scenarioJson.type !== 'background');
	}).map(function(scenarioJson) {
		return convertScenario(scenarioJson);
	});
}

/**
 * [exports description]
 * 
 * @method exports
 * @param {[type]}
 *            cucumberRaw [description]
 * @return {[type]} [description]
 */
function cucumberJunit(cucumberRaw) {
	var cucumberJson, output = [];

	if (cucumberRaw && cucumberRaw.toString().trim() !== '') {
		cucumberJson = JSON.parse(cucumberRaw);
		cucumberJson.forEach(function(featureJson) {
			output = output.concat(convertFeature(featureJson));
		});

		// If no items, provide something
		if (output.length === 0) {
			output.push({
				testsuite : []
			});
		}
	}

	// wrap all <testsuite> elements in <testsuites> element
	return xml({
		testsuites : output
	}, {
		indent : '    '
	});
};

module.exports = cucumberJunit;


const url = require('url');
const http = require('http');
const fs = require('fs');
const pug = require('pug');
const request = require('request');
const { userInfo } = require('os');

const app = http.createServer((request, response) => {
    let body = [];
    request.on('data', (chunk) => {
        body.push(chunk);
    }).on('end', () => {
        if (body.length > 0) {
            body = JSON.parse(Buffer.concat(body).toString());
        }

        let startTime = process.hrtime();

        const endpoint = url.parse(request.url, true).path.split('?')[0].replace('/', '');

        const query = url.parse(request.url, true).path.split('?')[1];

        let logs = {};
        logs.request = `${request.method} /${endpoint}`;

        let params;
        if (query) {

            params = JSON.parse('{"' + decodeURI(query).replace(/"/g, '\\"').replace(/&/g, '","').replace(/=/g, '":"') + '"}');
            logs.params = params;
        }

        //will either get the required handler or 'not found page'
        let chosenHandler = typeof router[endpoint] !== 'undefined' ? router[endpoint] : handlers.notFound;

        let callback = (statusCode, contentType, payload) => {
            let diff = process.hrtime(startTime);
            logs.status = statusCode;
            logs.response = payload;
            logs.time = getTimeInMs(diff);
            if (endpoint !== "metrics")
                log(logs);
            response.writeHead(statusCode, { "Content-Type": contentType });
            response.write(payload);
            response.end();
        };
        //wait for the callback
        if (params) {
            chosenHandler(params, callback);
        }
        else chosenHandler(body, callback);
    });

});

let handlers = {};

handlers.index = async function (body, callback) {
    //var body1=bodyl
    if (!body) {
        callback(400, 'application/json', JSON.stringify({ message: 'missing body' }));
        return;
    }
    let tdeeCalories = undefined;
    let foodCalories = 0;
    const finalResponse = {
        message: undefined
    };
    console.log(body);
    await Promise.all([TDEE(body), food(body)]).then(async function (values) {
        tdeeCalories = values[0];
        values[1].items.forEach(obj => {
            foodCalories += obj.calories;
        });

        finalResponse.message = await denumire(foodCalories - tdeeCalories);
    });

    callback(200, 'text/plain', JSON.stringify(finalResponse));

};
async function denumire(calories_target) {
    return new Promise(async function (resolve, reject) {
        let promises = [];
        for (let j = 1; j < 50; j++) {
            promises.push(UseThemBoth(j));
        }
        await Promise.all(promises).then((values) => {

            for (const value of values) {
                res = value.exercises[0].nf_calories;
                if (res >= calories_target) {
                    resolve(`You need to run ${values.indexOf(value) + 1} kilometers`);
                }
            };
        })
        resolve("index out of hope");
    });

};

handlers.page = function (params, callback) {
    provideFile("home.html", callback);
};

handlers.notFound = function (params, callback) {
    callback(404, 'application/json', JSON.stringify({ message: 'No such endpoint' }));
};


handlers.metrics = function (params, callback) {
    provideFile("info.log", callback, 'text');
};

async function UseThemBoth(i) {
    let url = `https://trackapi.nutritionix.com/v2/natural/exercise`;
    let aBody = { query: `ran ${i} kilometers` }
    let response = await createPostRequest2(url, aBody);
    try {
        return (response);
    } catch (e) {
        log(e.stack, "error");
        return 0;
    }
}

async function TDEE(body) {
    let url = `https://api.apollodiet.com/api/calculator/tdee`;
    body.Gender = 1;
    body.CalorieBMRFormula = 1;
    let response = await createPostRequest(url, body);
    try {
        return (response);
    } catch (e) {
        log(e.stack, "error");
        return 0;
    }
}

async function food(body) {
    let url = `https://api.calorieninjas.com/v1/nutrition?query=`;
    let response = await createGetRequestWithKey(url, body);

    try {
        return (response);
    } catch (e) {
        log(e.stack, "error");
        return 0;
    }
}

router = {
    home: handlers.index,
    page: handlers.page,
    metrics: handlers.metrics
};

//Start the server at port 3000
app.listen(3000);


function getTimeInMs(diff) {
    const NS_PER_SEC = 1e9;
    const MS_PER_NS = 1e-6;
    return ((diff[0] * NS_PER_SEC + diff[1]) * MS_PER_NS).toPrecision(6)
}

function provideFile(filename, callback, type = 'text/html') {
    fs.readFile(filename, function (err, data) {
        if (err) noFileFound();
        else sendFile(data);
    });
    function sendFile(data) {
        callback(200, type, data);
    }
    function noFileFound() {
        callback(500, 'application/json', { message: "The server has some sort of error" });
    }
}

function log(payload, type = "info") {
    if (type === "error") {
        fs.appendFile("./error.log", payload + '\n', function (err) {
            if (err) {
                return console.log(err);
            }
        });
    } else if (type === "info") {
        fs.readFile('./info.log', function (err, data) {
            let newData;
            if (!data.length) {
                newData = []
            } else {
                newData = JSON.parse(data.toString());
            }
            newData.push(payload);
            fs.writeFile('./info.log', JSON.stringify(newData), function (err) {
                if (err)
                    return console.log(err)
            })
        });
    }
}

function createGetRequestWithKey(url, body) {
    let options = {
        headers: {
            'content-type': 'application/json',
            'X-Api-Key': '+CzV9jZtG4dyj9LQI5Lnow==6xVTH5QDEWrDLVSO'
        },
        url: url + body.query,
    };

    if (body) {
        options.json = body;
    }
    return new Promise(function (resolve, reject) {
        request.get(options, function (error, response, body) {
            if (error) {
                log(error, "error");
                resolve(undefined);
            } else {
                try {
                    if (typeof body === "string") {
                        resolve(JSON.parse(body));
                    } else resolve(body);
                } catch (e) {
                    resolve(undefined);
                }
            }
        });
    });
}

function createPostRequest(url, body) {
    let options = {
        headers: {
            'content-type': 'application/json',

        },
        url: url,
    };
    if (body) {
        options.body = JSON.stringify(body);
    }
    return new Promise(function (resolve, reject) {
        request.post(options, function (error, response, body) {
            if (error) {
                log(error, "error");
                resolve(undefined);
            } else {
                try {

                    resolve((parseInt(body)));

                } catch (e) {
                    resolve(undefined);
                }
            }
        });
    });
}

function createPostRequest2(url, body) {
    let options = {
        headers: {
            'content-type': 'application/json',
            'x-app-id': 'd39ccfe3',
            'x-app-key': 'f6e0b0820011fcd73cfa3e079a17def9'
        },
        url: url,
    };
    if (body) {
        options.body = JSON.stringify(body);
    }
    return new Promise(function (resolve, reject) {
        request.post(options, function (error, response, body) {
            if (error) {
                log(error, "error");
                resolve(undefined);
            } else {
                try {
                    if (typeof body === "string") {
                        resolve(JSON.parse(body));
                    } else resolve(body);
                } catch (e) {
                    resolve(undefined);
                }
            }
        });
    });
}
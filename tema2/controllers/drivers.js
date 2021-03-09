const mongoDB = require('mongodb').MongoClient;
module.exports = {
    handler: handler
};

function handler(data, callback) {
    //extras is an array with all the other words after /drivers
    let extras = data.fullPath.split('/');
    extras.splice(0, 2);
    switch (data.method) {
        case 'get':
            switch (extras.length) {
                case 0:
                    getdrivers(data.query, callback);
                    break;
                case 1:
                    if (parseInt(extras[0]))
                        getdriver(parseInt(extras[0]), callback);
                    else noSuchEndpoint(callback);
                    break;
                default:
                    noSuchEndpoint(callback);
                    break;
            }
            break;
        case 'post':
            switch (extras.length) {
                case 0:
                    if (!data.body)
                        badRequest("A body must be provided", callback);
                    else postdriver(data.body, callback);
                    break;
                case 1:
                    if (parseInt(extras[0]))
                        if (!data.body)
                            badRequest("A body must be provided", callback);
                        else postdriverWithId(parseInt(extras[0]), data.body, callback);
                    else noSuchEndpoint(callback);
                    break;
                default:
                    noSuchEndpoint(callback);
                    break;
            }
            break;
        case 'put':
            switch (extras.length) {
                case 0:
                    callback(405);
                    break;
                case 1:
                    if (parseInt(extras[0]))
                        if (!data.body)
                            badRequest("A body must be provided", callback);
                        else putdriver(parseInt(extras[0]), data.body, callback);
                    else noSuchEndpoint(callback);
                    break;
                default:
                    noSuchEndpoint(callback);
                    break
            }
            break;
        case 'delete':
            switch (extras.length) {
                case 0:
                    callback(405);
                    break;
                case 1:
                    if (parseInt(extras[0]))
                        deletedriver(parseInt(extras[0]), callback);
                    else noSuchEndpoint(callback);
                    break;
                default:
                    noSuchEndpoint(callback);
                    break
            }
            break;
        default:
            noSuchEndpoint(callback);
            break;
    }
}

//route : GET /drivers
function getdrivers(query, callback) {
    mongoDB.connect('mongodb://localhost:27017', async function (err, client) {
        if (err) {
            serverError(callback);
            return;
        }
        let db = client.db('Rental');
        let drivers;
        if (query.name) {
            drivers = await db.collection('drivers').find({'name': {'$regex': query.name, '$options': 'i'}}).toArray();
        } else drivers = await db.collection('drivers').find().toArray();
        callback(200, drivers)
    });
}

//route : GET /drivers/{id}
function getdriver(id, callback) {
    mongoDB.connect('mongodb://localhost:27017', async function (err, client) {
        if (err) {
            serverError(callback);
            return;
        }
        let db = client.db('Rental');
        let driver = await db.collection('drivers').findOne({_id: id});
        if (driver) {
            callback(200, driver)
        } else {
            notFound(callback)
        }
    });
}

//route : POST /drivers
function postdriver(driver, callback) {
    mongoDB.connect('mongodb://localhost:27017', async function (err, client) {
        if (err) {
            serverError(callback);
            return;
        }
        let db = client.db('Rental');
        if (!driver.name || !driver.carId || !driver.lastcarIdDate || !driver.returnDate) {
            badRequest("The body provided is incomplete. Please submit a valid body.", callback);
            return;
        }
        var x=parseInt(driver.carId);
        let thecar = await db.collection('cars').findOne({_id: x,taken:"No"});
        if(!thecar){
            callback(404, {
                success: false,
                message: "No free car with that id"
            });
            return;
        }
        let regex = /^\d{4}[-]\d{2}[-]\d{2}$/;
        if (!driver.lastcarIdDate.match(regex) && !driver.returnDate.match(regex)) {
            badRequest("Date format should be either YYYY-MM-DD", callback);
            return;
        }
        let id = await getNextId();
        let strippeddriver = {
            _id: id,
            name: driver.name,
            carId: driver.carId,
            lastcarIdDate: driver.lastcarIdDate,
            returnDate: driver.returnDate
        };
        try{db.collection('cars').updateOne({_id: parseInt(driver.carId)}, {
            $set: {
                taken:"Yes",
                takenBy:id.toString(),
                lastTakenDate: driver.lastcarIdDate,
                returnDate: driver.returnDate
            }
        });}catch(e){print(e);}
        db.collection('drivers').insert(strippeddriver, function (err) {
            if (err) {
                serverError(callback);
            } else {
                callback(201, {
                    success: true,
                    message: "driver created",
                    location: `/drivers/${id}`
                })
            }
        });
    });
}

//route : POST /drivers/{id}
function postdriverWithId(id, driver, callback) {
    mongoDB.connect('mongodb://localhost:27017', async function (err, client) {
        if (err) {
            serverError(callback);
            return;
        }
        let db = client.db('Rental');

        if (!driver.name || !driver.carId || !driver.lastcarIdDate || !driver.returnDate) {
            badRequest("The body provided is incomplete. Please submit a valid body.", callback);
            return;
        }
        var x=parseInt(driver.carId);
        let thecar = await db.collection('cars').findOne({_id: x,taken:"No"});
        if(!thecar){
            callback(404, {
                success: false,
                message: "No free car with that id"
            });
            return;
        }
        let regex = /^\d{4}[-]\d{2}[-]\d{2}$/;
        if (!driver.lastcarIdDate.match(regex) && !driver.returnDate.match(regex)) {
            badRequest("Date format should be either YYYY-MM-DD", callback);
            return;
        }
        let found = await db.collection('drivers').findOne({_id: id});
        if (found) {
            callback(409, {
                success: false,
                message: "Resource already exists"
            });
            return;
        }
        let strippeddriver = {
            _id: id,
            name: driver.name,
            carId: driver.carId,
            lastcarIdDate: driver.lastcarIdDate,
            returnDate: driver.returnDate
        };
        try{db.collection('cars').updateOne({_id: parseInt(driver.carId)}, {
            $set: {
                taken:"Yes",
                takenBy:id.toString(),
                lastTakenDate: driver.lastcarIdDate,
                returnDate: driver.returnDate
            }
        });}catch(e){print(e);}
        db.collection('drivers').insert(strippeddriver, function (err) {
            if (err) {
                serverError(callback);
            } else {
                callback(201, {
                    success: true,
                    message: "driver created",
                    location: `/drivers/${id}`
                })
            }
        });
    });
}

//route : PUT /drivers/{id}
function putdriver(id, driver, callback) {
    mongoDB.connect('mongodb://localhost:27017', async function (err, client) {
        if (err) {
            serverError(callback);
            return;
        }
        let db = client.db('Rental');

        if (!driver.name || !driver.carId || !driver.lastcarIdDate || !driver.returnDate) {
            badRequest("The body provided is incomplete. Please submit a valid body.", callback);
            return;
        }
        let regex = /^\d{4}[-]\d{2}[-]\d{2}$/;
        if (!driver.lastcarIdDate.match(regex) && !driver.returnDate.match(regex)) {
            badRequest("Date format should be either YYYY-MM-DD", callback);
            return;
        }
        let found = await db.collection('drivers').findOne({_id: id});
        if (!found) {
            notFound(callback);
            return;
        }
        db.collection('drivers').updateOne({_id: id}, {
            $set: {
                _id: id,
                name: driver.name,
                carId: driver.carId,
                lastcarIdDate: driver.lastcarIdDate,
                returnDate: driver.returnDate
            }
        }, {upsert: true}, function (err) {
            if (err) {
                serverError(callback);
            } else {
                callback(200, {
                    success: true,
                    message: "driver updated",
                    location: `/drivers/${id}`
                })
            }
        });
    });
}

//route : DELETE /drivers/{id}
function deletedriver(id, callback) {
    mongoDB.connect('mongodb://localhost:27017', async function (err, client) {
        if (err) {
            serverError(callback);
            return;
        }
        let db = client.db('Rental');
        let result = await db.collection('drivers').deleteOne({_id: id});
        //a car was deleted
        if (result.deletedCount > 0) {
            callback(200)
        } else notFound(callback)
    });
}


/**Shortcut Functions**/
function noSuchEndpoint(callback) {
    callback(400, {
        "message": "No such endpoint"
    })
}

function badRequest(message, callback) {
    callback(400, {
        success: false,
        message: message
    })
}

function notFound(callback) {
    callback(404, {
        success: false,
        message: "driver not found"
    })
}

function serverError(callback) {
    callback(500, {
        success: false,
        message: "Internal server error"
    })
}

async function getNextId() {
    const client = await mongoDB.connect('mongodb://localhost:27017')
        .catch(err => {
            console.log(err);
        });
    if (!client) {
        return;
    }
    try {
        const db = client.db("Rental");
        let collection = db.collection('drivers');
        let res = await collection.find().sort({_id: -1}).toArray();
        if (res.length > 0) {
            return parseInt(res[0]._id) + 1
        } else return 1

    } catch (err) {
        console.log(err);
    } finally {
        await client.close();
    }
}
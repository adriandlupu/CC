const mongoDB = require('mongodb').MongoClient;
module.exports = {
    handler: handler
};

function handler(data, callback) {
    //extras is an array with all the other words after /cars
    let extras = data.fullPath.split('/');
    extras.splice(0, 2);
    switch (data.method) {
        case 'get':
            switch (extras.length) {
                case 0:
                    getcars(data.query, callback);
                    break;
                case 1:
                    if (parseInt(extras[0]))
                        getcar(parseInt(extras[0]), callback);
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
                    else postcar(data.body, callback);
                    break;
                case 1:
                    if (parseInt(extras[0]))
                        if (!data.body)
                            badRequest("A body must be provided", callback);
                        else postcarWithId(parseInt(extras[0]), data.body, callback);
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
                        else putcar(parseInt(extras[0]), data.body, callback);
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
                    deletecars(callback);
                    break;
                case 1:
                    if (parseInt(extras[0]))
                        deletecar(parseInt(extras[0]), callback);
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

//route : GET '/cars'
function getcars(query, callback) {
    mongoDB.connect('mongodb://localhost:27017', async function (err, client) {
        if (err) {
            serverError(callback);
            return;
        }
        let db = client.db('Rental');
        let cars;
        if (query.title) {
            console.log("456");
            cars = await db.collection('cars').find({'title': {'$regex': query.title, '$options': 'i'}}).toArray();
        } else cars = await db.collection('cars').find().toArray();
        callback(200, cars)
    });
}

//route : GET /cars/{id}
function getcar(id, callback) {
    mongoDB.connect('mongodb://localhost:27017', async function (err, client) {
        if (err) {
            serverError(callback);
            return;
        }
        let db = client.db('Rental');
        let car = await db.collection('cars').findOne({_id: id});
        if (car) {
            callback(200, car)
        } else {
            notFound(callback)
        }
    });
}


//route : POST /cars
function postcar(car, callback) {
    mongoDB.connect('mongodb://localhost:27017', async function (err, client) {
        if (err) {
            serverError(callback);
            return;
        }
        let db = client.db('Rental');
        if (!car.title) {
            badRequest("The body provided is incomplete. Please submit a valid body.", callback);
            return;
        }
        
        let id = await getNextId('cars');
        let strippedcar = {
            _id: id,
            title: car.title,
            taken: "No",
            takenBy: ""
        };
        db.collection('cars').insert(strippedcar, function (err) {
            if (err) {
                serverError(callback);
            } else {
                callback(201, {
                    success: true,
                    message: "car created",
                    location: `/cars/${strippedcar._id}`
                })
            }
        });
    });
}

//route : POST /cars/{id}
function postcarWithId(id, car, callback) {
    mongoDB.connect('mongodb://localhost:27017', async function (err, client) {
        if (err) {
            serverError(callback);
            return;
        }
        let db = client.db('Rental');
        if (!car.title) {
            badRequest("The body provided is incomplete. Please submit a valid body.", callback);
            return;
        }

        let found = await db.collection('cars').findOne({_id: id});
        if (found) {
            callback(409, {
                success: false,
                message: "Resource already exists"
            });
            return;
        }
        let strippedcar = {
            _id: id,
            title: car.title,
            taken: "No",
            takenBy: ""
        };
        db.collection('cars').insert(strippedcar, function (err) {
            if (err) {
                serverError(callback);
            } else {
                callback(201, {
                    success: true,
                    message: "car created",
                    location: `/cars/${strippedcar._id}`
                })
            }
        });
    });
}

//route : PUT /cars/{id}
function putcar(id, car, callback) {
    mongoDB.connect('mongodb://localhost:27017', async function (err, client) {
        if (err) {
            serverError(callback);
            return;
        }
        let db = client.db('Rental');
        if (!car.title || !car.taken || !car.takenBy || !car.lastTakenDate || !car.returnDate) {
            badRequest("The body provided is incomplete. Please submit a valid body.", callback);
            return;
        }
        let regex = /^\d{4}[-]\d{2}[-]\d{2}$/;
        if (!car.lastTakenDate.match(regex) && !car.returnDate.match(regex)) {
            badRequest("Date format should be either YYYY-MM-DD", callback);
            return;
        }
        let found = await db.collection('cars').findOne({_id: id});
        if (!found) {
            notFound(callback);
            return;
        }
        db.collection('cars').updateOne({_id: id}, {
            $set: {
                title: car.title,
                taken: car.taken,
                takenBy: car.takenBy,
                lastTakenDate: car.lastTakenDate,
                returnDate: car.returnDate
            }
        }, {upsert: true}, function (err) {
            if (err) {
                serverError(callback);
            } else {
                callback(200, {
                    success: true,
                    message: "car updated",
                    location: `/cars/${id}`
                })
            }
        });
    });
}

//route : DELETE /cars/{id}
function deletecar(id, callback) {
    mongoDB.connect('mongodb://localhost:27017', async function (err, client) {
        if (err) {
            serverError(callback);
            return;
        }
        let db = client.db('Rental');
        let result = await db.collection('cars').deleteOne({_id: id});
        //a car was deleted
        if (result.deletedCount > 0) {
            callback(200)
        } else notFound(callback)
    });
}

function deletecars(callback) {
    mongoDB.connect('mongodb://localhost:27017', async function (err, client) {
        if (err) {
            serverError(callback);
            return;
        }
        let db = client.db('Rental');
        let result = await db.collection('cars').deleteMany({_id: {$gt:0}});
        //all cars deleted
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
        message: "car not found"
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
        let collection = db.collection('cars');
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

setInterval(
async function updateTaken(){
    const client = await mongoDB.connect('mongodb://localhost:27017')
        .catch(err => {
            console.log(err);
        });
    if (!client) {
        return;
    }
    try {
        const db = client.db("Rental");
        let collection = db.collection('cars');
        let today = new Date().toISOString().slice(0, 10);
        collection.updateMany({returnDate:{$lt:today}},{$set:{taken:"No"}})

    } catch (err) {
        console.log(err);
    } finally {
        await client.close();
    }
},86400000);
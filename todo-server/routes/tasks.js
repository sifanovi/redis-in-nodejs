var express = require("express");
var router = express.Router();
var redis = require("redis");
var client = redis.createClient(6379);
var DB = require("../models/index");
var tasks = DB.tasks;
var sequelize = DB.sequelize;
var statusCodes = require("http-status-codes");
var bodyParser = require("body-parser");
router.use(bodyParser.json()); // for parsing application/json
router.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

const isExistInCache = (req, res, next) => {
    //First check in Redis
    client.get(req.params.id, (err, data) => {
        if (err) {
            next(err)
        }
        if (data) {
            const reponse = JSON.parse(data);
            res.send({ data: reponse, message: "Task list found", status: statusCodes.OK });


        }
        else {
            next();
        }
   })

}


router.get("/", function (req, res) {
    return tasks.findAll().then(function (tasks) {
        res.send({ data: tasks, message: "Task list found", status: statusCodes.OK });


    }).catch(function (err) {
        res.send({ status: statusCodes.INTERNAL_SERVER_ERROR, message: err });
        console.error(err);
    });

});
router.get("/:id", isExistInCache, function (req, res) {
    return tasks.findOne(
        {
            attributes: ["taskName", "taskDetails", "taskStatus"],
            where: {
                id: req.params.id
            }
        }
    ).then(function (tasks) {
        res.send({ data: tasks, message: "Item Fetched", status: statusCodes.OK });

    }).catch(function (err) {
        res.send({ status: statusCodes.INTERNAL_SERVER_ERROR, message: err });
        console.error(err);
    });
})

router.post("/:id", function (req, res) {

    req.body.updatedAt = new Date();

    return tasks.update(req.body, {
        where: {
            id: req.params.id
        }
    }).then(function (results) {
    
         return tasks.findOne(
            {
                where: {
                    id: req.params.id
                },
                raw:"true"
            }).then(function (tasks) {
                console.log(tasks);
                client.setex(tasks.id,60000,JSON.stringify(tasks), function (err, response) {
                    if (err) {
                        console.log("could not store in redis");
                    }
                    else {
                        console.log("stored in redis");
                    }
                })
                res.send({ data: tasks, message: "Task Updated", status: statusCodes.OK });
            }).catch(function (err) {
                console.log(err);
            })

      

    }).catch(function (err) {
        res.send({ status: statusCodes.INTERNAL_SERVER_ERROR, message: err });
        console.error(err);
    });

})
router.put("/:id", function (req, res) {
    req.body.updatedAt = new Date()
    return tasks.findOne({
        where: {
            id: req.params.id
        },
        raw: true,
    }).then(function (result) {
        console.log(result);
        if (result) {
            return tasks.update(req.body, {
                where: {
                    id: req.params.id
                }
            }).then(function (results) {
                 tasks.findOne(
                    {
                        attributes: ["taskName", "taskDetails", "taskStatus"],
                        where: {
                            id: req.params.id
                        }
                    }).then(function (tasks) {
                        console.log(tasks);
                        client.setex(tasks.id, 600, JSON.stringify(tasks), function (err, response) {
                            if (err) {
                                console.log("could not store in redis");
                            }
                            else {
                                console.log("stored in redis");
                            }
                        })
                    }).catch(function (err) {
                        console.log(err);
                    })


                res.send({ data: tasks, message: "Task Updated", status: statusCodes.OK });

            }).catch(function (err) {
                res.send({ status: statusCodes.INTERNAL_SERVER_ERROR, message: err })
                console.error(err);
            });
        }
    }).catch(function (err) {
        res.send({ data: [], message: err, status: statusCodes.NOT_FOUND })
        console.error(err);
    });
});

router.post("/", function (req, res) {


    req.body.createdAt = new Date();



    tasks.create(req.body).then(function (tasks) {

        client.setex(tasks.id, 60000, JSON.stringify(tasks), function (err, response) {
            if (err) {
                console.log("could not store in redis");
            }
            else {
                console.log("stored in redis");
            }
        })
        res.send({ data: tasks, message: "Task Created", status: statusCodes.CREATED });


    }).catch(function (err) {
        res.send({ data: [], message: err, status: statusCodes.INTERNAL_SERVER_ERROR })
        console.error(err);
    });

});

router.delete("/:id", function (req, res) {

    req.body.createdAt = new Date();

    tasks.destroy({
        where: {
            id: req.params.id
        }
    }).then(function (tasks) {
        client.del(req.params.id,function(err,success)
        {
            if(err)
            {
                cosnsole.log("could not from redis")
            }
            else{
            console.log("deleted from redis")
            }
        });
        res.send({ data: tasks, message: "Task deleted", status: statusCodes.OK });


    }).catch(function (err) {
        res.send({ data: [], message: err, status: statusCodes.INTERNAL_SERVER_ERROR })
        console.log(err);
    });

});

module.exports = router;

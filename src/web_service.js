const http = require("http");
const fs = require("fs");

const obtain_plan = require("./obtain_plan.js");
const gen_codefrag = require("./gen_codefrag.js");

http.createServer(function (request, response) {

    response.setHeader("Content-Type", "text/html; charset=utf-8;");
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "OPTIONS, POST, GET, PUT, DELETE");
    response.setHeader("Access-Control-Max-Age", 2592000);


    if (request.url == "/construct") {

        var task = {};
        let data = "";
        request.on("data", chunk => {
            data += chunk;
        });
        request.on("end", () => {
            task = JSON.parse(data);

            if (!("task_name" in task && "body" in task)) {
                response.write("Invalid request");
                response.end();
            }
            else {
				// assume we have only one task in jaz:
                var plan = obtain_plan(task["body"]).plans["plan1"]["plan"].sequence;
				var { manifest, listing } = gen_codefrag(task["body"], plan);
                response.write(listing);
                response.end();
            }
        });
    }
    else {
        response.statusCode = 404;
        response.write("Not Found");
        response.end();
    }

}).listen(9200, function () {
    console.log("The server is running at http://localhost:9200")
});

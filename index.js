var app = require("express")();
var http = require("http").createServer(app);
var io = require("socket.io")(http);

app.get("/", function(req, res) {
  res.sendFile("./index.html", { root: __dirname });
});

http.listen(2300, function() {
  console.log("listening on *:2300");
});

//IO-----------------------------------------------------------------------------------------------
var users = [];

io.on("connection", function(socket) {
  console.log("a user connected");
  io.emit("newUser");

  socket.on("disconnect", function() {
    users.forEach(user => {
      if (user.socket === socket) {
        //notify people
        if (user.name != null) {
          io.emit("chatMessage", user.name + " just disconnected");
          console.log("user " + user.name + " disconnected");
        }
      }
    });
    //remove user
    users = users.filter(user => user.socket != socket);
  });

  socket.on("login", function(name) {
    users.push({ name, socket });
    io.emit(name + " just joined!");
  });

  socket.on("chatMessage", function(msg) {
    io.emit("chatMessage", msg);
  });
});

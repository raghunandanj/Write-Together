const mongoose = require("mongoose");
const Document = require("./models/Document");
mongoose.connect("mongodb://localhost:27017/collab-docs").then(async () => {
  const docs = await Document.find({}, "title roomCode");
  console.log(docs);
  process.exit(0);
});

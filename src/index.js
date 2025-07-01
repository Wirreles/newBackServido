const app = require("./app");

async function main() {
  app.listen(3005);
  console.log("Server on port", 3005);
}

main();

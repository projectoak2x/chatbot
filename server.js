const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const { Configuration, OpenAIApi } = require("openai");
const mongoose = require('mongoose');
const User = require('./models/User');

require('dotenv').config(); 

mongoose.connect(process.env.MONGO_URL)

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

// Middleware to parse JSON requests
app.use(bodyParser.json());

app.post('/webhook', async (req, res) => {
  let body = req.body;
  console.log(body);
  if (body.object === "page") {
    // Returns a '200 OK' response to all requests
    res.status(200).send("EVENT_RECEIVED");
  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }
})

// Add support for GET requests to our webhook
app.get("/webhook", (req, res) => {
  
  // Parse the query params
    let mode = req.query["hub.mode"];
    let token = req.query["hub.verify_token"];
    let challenge = req.query["hub.challenge"];
  
    // Check if a token and mode is in the query string of the request
    if (mode && token) {
      // Check the mode and token sent is correct
      if (mode === "subscribe" && token === process.env.WEBHOOK_TOKEN) {
        // Respond with the challenge token from the request
        console.log("WEBHOOK_VERIFIED");
        res.status(200).send(challenge);
      } else {
        // Respond with '403 Forbidden' if verify tokens do not match
        res.sendStatus(403);
      }
    }
  });

  // Verify that the callback came from Facebook.
function verifyRequestSignature(req, res, buf) {
  var signature = req.headers["x-hub-signature-256"];

  if (!signature) {
    console.warn(`Couldn't find "x-hub-signature-256" in headers.`);
  } else {
    var elements = signature.split("=");
    var signatureHash = elements[1];
    var expectedHash = crypto
      .createHmac("sha256", config.appSecret)
      .update(buf)
      .digest("hex");
    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}


app.get('/chat', async (req, res) => {
  const q = req.query.q;
  let id = req.query.id;
  const name = req.query.name;
  const reset = req.query.reset;

  if (id==undefined||id=="") {
    const user = await User.create({
      name: name,
      points: 50,
      role: 'user',
    })
    id = user._id.toString();
  }

  const user = await User.findById(id).exec();

  if (!user) {
    console.error('User not found');
    // Handle the case where the user is not found
    return;
  }

  // Add the latest message
  if(user.messages){
    if(reset) user.messages = [{ role: 'user', content: q }];
    else user.messages = [...user.messages, { role: 'user', content: q }];
    await user.save();
  }
  else {
    user.messages = [{ "role": 'user', "content": q }];
    await user.save();
  }
  
  let payload = {
    "model": "gpt-3.5-turbo-0613",
    "messages": [
     {"role": "system", "content": "You are a friendly, helpful assistant and give truthful answers. If you do not know the answer, say: Sorry, Hindi ko alam. Answer as concisely as possible"},
     ...user.messages
     ],
     "functions":[
      {
        "name": "generate_image",
        "description": "Generates an image based on the image description",
        "parameters": {
          "type": "object",
          "properties": {
            "description":{
              "type": "string",
              "description":"The image description"
            }
          },
          "required": ["description"]
        }
      }
     ],
     "function_call":"auto",
    "temperature": 0.7
  }
  const openai_response = await openai.createChatCompletion(payload);
  const data = openai_response.data.choices[0]
  let content = data.message.content;
  let type = "text";

  if(content==null){
    const jsonData = JSON.parse(data.message.function_call.arguments);
    if(data.message.function_call.name=='generate_image'){
      content = await generateImage(jsonData.description);
      type = "image";
    }
  }
  
  try {
    res.json({
      data: content,
      type: type,
      id: id,
    });
  } catch (error) {
    res.status(500).send('Internal Server Error');
  }

});

async function generateImage(prompt){
  const response = await openai.createImage({
    prompt: prompt,
    n: 1,
    size: "512x512",
  });
  return response.data.data[0].url
}


// Start the server
app.listen(process.env.PORT || 3000, () => {
  console.log('Server started!');
});
Neru EOS sample app

## Summary

This application runs in Vonage's VCR, enabling customers to upload a CSV file with customizable key-value pairs. 
When a CSV file is uploaded, a cron job processes its content and sends SMS or RCS messages accordingly.

## Pre-Requisites

1. Install NodeJS
2. Install [VCR CLI](https://github.com/Vonage/cloud-runtime-cli)
3. Make sure you have a [Vonage account](https://dashboard.nexmo.com/)

## Installation

1. Run `npm install`
2. Run `vcr configure` where you will be asked to set a Vonage apikey and secret.
3. Create a `vcr.yml` file as per `vcr-sample.yml`

## Run the project

You will deploy this code in VCR. You can run in **debug** or **prod** mode. 

```
vcr secret create --name apikey --value [YOUR VINAGE API KEY]
vcr secret create --name apiSecret --value [YOUR VONAGE API SECRET]
```

Replace the values within the brackets with the ApiKey and ApiSecret from your Vonage Dashboard.

Init VCR with this information:
```
vcr init
```

### NOTES
Inside your ```vcr.yml``` file, check that application-id is the one you want to use.
```runtime: nodejs16``` is the NodeJS version you are using.

### Deploy
Finally, run ```vcr debug``` to send all the informaiton to VCR. 
This will let you inspect the console and check for errors locally.
You will have a public URL where this NodeJS project is running.

## Using the app

POST to `/scheduler` with {"command": "start", "maxInvocations": number}

This will start a cron job that runs every minute for 3 minutes (this is for testing purposes and needs to be changed for production)

This scheduler will call the `/checkandsend`endpoint which will check if there are csv files that need to be processed. If there are files that need to be processed, the file will be read, SMS sent and a new CSV file will be created on `/output` directory containing the results of the SMS sending.

## Stopping the app

POST to `/scheduler` with {"command": "stop"}

## Sending a message without a CSV file

Send a ```POST``` request to ```/api/messages/send/``` with the following body:

```
{
   "message_type": "text",
   "templateId": "1",
    "channel": "sms",
    "from": "447700900001",
    "to": "447700900000",
    "data": [{
        "NAME":"Walter".
        "FELD01":"My value here"
    }]
}
```

The application retrieves the template ID from the payload and sends a message via SMS or RCS, depending on the specified ```channel```. 
The ```data``` object contains key-value pairs used to populate placeholders within the template.


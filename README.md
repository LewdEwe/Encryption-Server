
# Encryption Server

This Node.js encryption server is used to service TCP network requests for data to be encrypted or decrypted using the symmetric encryption of the Sodium library.

The purpose of this is to have encryption keys and processing located on a separate server from the database or API servers. If the other servers are compromised then the attacker will not easily have access to the keys to decrypt protected database fields. Gaining the keys will require getting into yet another server, which is likely achievable but it does at least slow down the attacker and give you more time to realise that an attack is in progress.

Naturally, use of this server will only accommodate low to medium load levels, and it will slow down your system due to the extra time required for the TCP transaction and encryption/decryption. Typically you would not encrypt everything in your database with this, only the fields which contain sensitive or valuable data, such as email or postal addresses. For situations requiring high performance or critical enterprise security you should really consider things such as full disk encryption, Hardware Security Modules (HSM) or specialised servers etc.

**Caution: this application has not been vetted by security experts, you should seek professional advice if running this in a production environment.**

The Sodium library documentation is at https://download.libsodium.org/doc/.

## Dependencies

Node Module | URL
---|---
flow | https://www.npmjs.com/package/flow  
js-yaml | https://www.npmjs.com/package/js-yaml  
sodium | https://www.npmjs.com/package/sodium

The Sodium NPM package will compile the C++ Sodium library. If you find you are getting compiler errors and you are the root user then either install without root privileges or try adding the `--unsafe-perm` flag:

```bash
npm install sodium --save --unsafe-perm
```

https://github.com/paixaop/node-sodium/issues/99

## Installation

You can install with NPM:

```bash
npm install @lewdewe/encryption-server
```

Or you can clone from one of the repositories:

```bash
git clone https://github.com/LewdEwe/Encryption-Server.git
```

## Configuration

The configuration is stored as YAML in the `config.yaml` file.

In the configuration you will see a couple of example encryption keys. To easily create a new key to add to the configuration refer to the `create_new_key` command in the _Interaction_ section below.

## Running the Server

For a quick test you can start it directly with Node by going into the package folder and typing:

```bash
node main.js
```

For daemonisation and automatic start-up on boot I have included a PM2 configuration file in the package. For more details on PM2 see their project page:

https://www.npmjs.com/package/pm2

If you're going to use PM2 then be sure to edit the `pm2_config.json` file and set suitable paths for the log files.

To start the server with PM2 go into the package folder and type:

```bash
pm2 start pm2_config.json --env production
```

To view/monitor log output you can use:

```bash
pm2 logs
```

You can see a list of all running PM2 processes and their IDs and status by typing:

```bash
pm2 list
```

You can end the process - assuming this is the first PM2 process and has an ID of 0 (zero) - by typing:

```bash
pm2 delete 0
```

To get automatic start-up on boot please refer to the PM2 documentation.

## Interaction

This server uses a very simple line-based protocol over TCP. Just send your request as a line of JSON suffixed with a line feed character. The response will likewise be a line of JSON suffixed with a line feed character.

Usually you would create a TCP client to connect to the server and issue requests. But for a quick test you can use telnet:

```bash
telnet 127.0.0.1 10000
```

If there is a problem with your request - such as unrecognised key name, JSON error or corrupted encrypted data - then you will receive a null response:

```json
{"data":null}
```

### encrypt

To encrypt data send the following command:

```json
{"action":"encrypt","key_name":"example_key","data":"This is some test plaintext data!"}
```

The key name is whatever you want it to be, but it must match one of the key names in the configuration file. The response will contain the nonce and cipher, both Base64 encoded, and look similar to this:

```json
{"data":"$Ms0MDzNraWKypCX4Ik5GjZ6hW41JXBA5$b7jFYGh3+fB3B+wLIzddekXlGX4WzSWjSa2nikiLmP/FpF7UdNa7EojkXGkZbbtP8A=="}
```

### decrypt

To decrypt data send this command:

```json
{"action":"decrypt","key_name":"example_key","data":"$Ms0MDzNraWKypCX4Ik5GjZ6hW41JXBA5$b7jFYGh3+fB3B+wLIzddekXlGX4WzSWjSa2nikiLmP/FpF7UdNa7EojkXGkZbbtP8A=="}
```

The response will contain the plaintext data:

```json
{"data":"This is some test plaintext data!"}
```

### calculate_encrypted_size

To check how much storage space an encrypted item would consume use the ```calculate_encrypted_size``` command:

```json
{"action":"calculate_encrypted_size","data":"asdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdaaasdasdas"}
```

This can be useful for testing how big your database fields etc. need to be. It will generate a temporary key, encrypt the plaintext data and tell you what the size of the nonce & cipher string was:

```json
{"data":"Original size: 100 bytes; encrypted size: 210 bytes."}
```

### create_new_key

To easily create a new encryption key send the ```create_new_key``` command:

```json
{"action":"create_new_key"}
```

The response will give you a new hex encoded key and a couple of metrics for your curiosity. It will look similar to this:

```json
{"data":{"key_size":32,"nonce_size":24,"key":"f52b44624f38eebf2ec4368007aadb64110009501d20e9f60fc5ebc1c1028967"}}
```

You can then copy and paste this key into the configuration file.

### request_id

For any request you can add an optional ```request_id``` value. If this is present in the request then the same value will be added to the response. For example:

```json
{"request_id":654,"action":"encrypt","key_name":"example_key","data":"This is some test plaintext data!"}
```

Which gives:

```json
{"request_id":654,"data":"$jyeoTRlas90rqAb+XdTrqW75SEjbpS5i$9WN9GOYO4Ajjst9nUo+VLzz3N3fM4JPplMqldtzM/9G+Re7H+9M7w4kSnwiaU4PplQ=="}
```

## Request Statistics

Request statistics will be available unless you have edited the ```server.js``` file to set ```STATS_ENABLED``` to ```false```. The main purpose of this is for basic performance checks and to see if there any strange requests that would indicate a network intrusion. To receive the network stats send this request:

```json
{"action":"server_request_stats"}
```

The response will look something like this:

```json
{"data":{"server_start_time":1483306247156,"total_stats":{"total_requests":4,"requests_by_address":{"127.0.0.1:34304":4},"requests_by_type":{"create_new_key":{"127.0.0.1:34304":3},"server_request_stats":{"127.0.0.1:34304":1}}},"per_minute_stats":{"total_requests":1,"requests_by_address":{"127.0.0.1:34304":1},"requests_by_type":{"create_new_key":{"127.0.0.1:34304":1}}}}}
```

Or parsed for clarity:

```javascript
{
data:
	{
	server_start_time:					1483306247156,
	total_stats:
		{
		total_requests:					4,

		requests_by_address:
			{
			"127.0.0.1:34304":			4
			},

		requests_by_type:
			{
			create_new_key:
				{
				"127.0.0.1:34304":		3
				},
			server_request_stats:
				{
				"127.0.0.1:34304":		1
				}
			}
		},
	per_minute_stats:
		{
		total_requests:					1,

		requests_by_address:
			{
			"127.0.0.1:34304":			1
			},

		requests_by_type:
			{
			create_new_key:
				{
				"127.0.0.1:34304":		1
				}
			}
		}
	}
}
```

The per-minute stats are **not** the last 60 seconds from this instant, as you might imagine - because this would require more memory and processing effort and is probably not that important. Rather, it is the requests to have occurred in the previous 60 second timeslot. It is easy to understand if you consider the code snippet that controls this:

```javascript
if(per_minute_stats === null || (current_time - last_stats_time) >= 60000)
	{
	last_per_minute_stats = per_minute_stats;
	per_minute_stats =	{
						total_requests:			1,
						requests_by_address:	{[remote_address]: 1},
						requests_by_type:		{[request.action]: {[remote_address]: 1}}
						};
	last_stats_time = current_time;
	}
```

Requests are added to the current `per_minute_stats` object but it is the `last_per_minute_stats` that you see in the stats response from the server.

## License

This repository is published under the MIT license. Copyright (c) 2016-2017 Lewd Ewe Ltd.

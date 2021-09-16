# SLOBS for EvntBoard

Doc : https://stream-labs.github.io/streamlabs-obs-api-docs/docs/index.html

## Config

```json5
{
  "host": "localhost", // EvntBoard HOST (optionnal)
  "port": 5001, // Evntboard PORT (optionnal)
  "config": {
    "name": "slobs", // if no name is provided default value is "slobs" (optionnal)
    "host": "localhost",
    "port": 5123,
    "token": "mySuperAccessToken"
  }
}
```

## Multiple config

Name property should be different :)

```json5
{
  "host": "localhost", // EvntBoard HOST (optionnal)
  "port": 5001, // Evntboard PORT (optionnal)
  "config": [
    {
      "name": "slobs-mainaccount", // if no name is provided default value is "slobs-1" (optionnal)
      "host": "localhost",
      "port": 5123,
      "token": "mySuperAccessToken"
    },
    {
      "name": "slobs-secondaccount", // if no name is provided default value is "slobs-2" (optionnal)
      "host": "localhost",
      "port": 5125,
      "token": "mySecondSuperAccessToken"
    }
  ]
}
```

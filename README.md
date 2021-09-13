# SLOBS for EvntBoard

## Config

```json5
{
    "name": "slobs", // if no name is provided default value is "slobs"
    "config": {
      "host": "localhost", 
      "port": 5251, 
      "token": "myAccessToken"
    }
}
```

## Multiple config

Name property should be different :)
Otherwise you can filter event from the specific source !

```json5
[
  {
    "name": "slobs-pc2", // if no name is provided default value is "slobs"
    "config": {
      "host": "localhost",
      "port": 5251,
      "token": "myFirstAccessToken"
    }
  },
  {
    "name": "slobs-pc1", // if no name is provided default value is "slobs"
    "config": {
      "host": "localhost",
      "port": 5252,
      "token": "mySecondAccessToken"
    }
  }
]
```

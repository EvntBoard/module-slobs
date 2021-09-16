import { ConfigLoader } from "./ConfigLoader";
import { SlobsConnexion } from "./SlobsConnexion";

const main = async () => {
  const configLoader = new ConfigLoader();
  await configLoader.load();

  const conf = configLoader.getConfig();

  if (!Array.isArray(conf.config)) {
    if (!conf.config.name) {
      conf.config.name = "streamlabs";
    }
    new SlobsConnexion(conf.host, conf.port, conf.config);
  } else {
    conf.config.forEach((value, index) => {
      if (!value.name) {
        value.name = `streamlabs-${index + 1}`;
      }
      new SlobsConnexion(conf.host, conf.port, value);
    });
  }
};

main();

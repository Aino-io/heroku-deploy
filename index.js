const core = require("@actions/core");
const { promisify } = require("util");

const exec = promisify(require("child_process").exec);

async function loginHeroku() {
  const login = core.getInput("email");
  const password = core.getInput("api_key");

  try {
    await exec(`echo ${password} | docker login --username=${login} registry.heroku.com --password-stdin`);
    console.log("Logged in succefully ✅");
  } catch (error) {
    core.setFailed(`Authentication process faild. Error: ${error.message}`);
  }
}

async function buildPushAndDeploy() {
  const appName = core.getInput("app_name");
  const dockerFilePath = core.getInput("dockerfile_path");
  const targetPath = core.getInput("target_path") || ".";
  const buildOptions = core.getInput("options") || "";
  const processType = core.getInput("process_type") || "web";
  const herokuAction = herokuActionSetUp(appName, processType);

  console.log(`appName: ${appName} dockerFilePath: ${dockerFilePath} targetPath: ${targetPath} buildOption: ${buildOptions}`);

  const dockerCmd = `docker build --file ${dockerFilePath}/Dockerfile --build-arg ${buildOptions} --tag registry.heroku.com/${appName}/web ${targetPath}`;
  console.log(`dockerCmd: ${dockerCmd}`);
  try {
    await exec(dockerCmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`docker build error: ${error}`);
        return;
      }
      console.log(`docker build stdout: ${stdout}`);
      console.error(`docker build stderr: ${stderr}`);
    });
    console.log("Image built 🛠");

    await exec(herokuAction("push"), (error, stdout, stderr) => {
      if (error) {
        console.error(`heroku push error: ${error}`);
        return;
      }
      console.log(`heroku push stdout: ${stdout}`);
      console.error(`heroku push stderr: ${stderr}`);
    });
    console.log("Container pushed to Heroku Container Registry ⏫");

    await exec(herokuAction("release"), (error, stdout, stderr) => {
      if (error) {
        console.error(`heroku release error: ${error}`);
        return;
      }
      console.log(`heroku release stdout: ${stdout}`);
      console.error(`heroku release stderr: ${stderr}`);
    });
    console.log("App Deployed successfully 🚀");
  } catch (error) {
    core.setFailed(`Something went wrong building your image. Error: ${error.message}`);
  }
}

/**
 *
 * @param {string} appName - Heroku App Name
 * @returns {function}
 */
function herokuActionSetUp(appName, processType) {
  /**
   * @typedef {"push" | "release"} Actions
   * @param {Actions} action - Action to be performed
   * @returns {string}
   */
  return function herokuAction(action) {
    const HEROKU_API_KEY = core.getInput("api_key");
    const exportKey = `HEROKU_API_KEY=${HEROKU_API_KEY}`;

    return `${exportKey} heroku container:${action} ${processType} --app ${appName}`
  }
}

loginHeroku()
  .then(() => buildPushAndDeploy())
  .catch((error) => {
    console.log({ message: error.message });
    core.setFailed(error.message);
  })

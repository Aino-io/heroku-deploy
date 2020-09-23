const core = require("@actions/core");
const { promisify } = require("util");

const exec = promisify(require("child_process").exec);

async function loginHeroku() {
  const login = core.getInput("email");
  const password = core.getInput("api_key");

  try {
    await exec(`echo ${password} | docker login --username=${login} registry.heroku.com --password-stdin`);
    console.log("Logged in successfully ✅");
  } catch (error) {
    core.setFailed(`Authentication process failed. Error: ${error.message}`);
  }
}

async function buildPushAndDeploy() {
  try {
    const appName = core.getInput("app_name");
    const dockerFilePath = core.getInput("dockerfile_path");
    const targetPath = core.getInput("target_path") || ".";
    const buildOptions = core.getInput("options") || "";
    const processType = core.getInput("process_type") || "web";
    const herokuAction = herokuActionSetUp(appName, processType);

    const dockerCmd = `docker build --file ${dockerFilePath}/Dockerfile --build-arg ${buildOptions} --tag registry.heroku.com/${appName}/${processType} ${targetPath}`;

    await run(dockerCmd);
    console.log("Image built 🛠");

    await run(`docker push registry.heroku.com/${appName}/${processType}`);
    console.log("Container pushed to Heroku Container Registry ⏫");

    await run(herokuAction("release"));
    console.log("App Deployed successfully 🚀");
  } catch (error) {
    core.setFailed(`Something went wrong building your image. Error: ${error.message}`);
  }
}

async function run(cmd) {
  const { stdout, stderr } = await exec(cmd);
  console.log("stdout:", stdout);
  console.error("stderr:", stderr);
}

/**
 *
 * @param {string} appName - Heroku App Name
 * @param {string} processType - Heroku process type
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

    return `${exportKey} heroku container:${action} ${processType} --app ${appName}`;
  };
}

loginHeroku()
  .then(() => buildPushAndDeploy())
  .catch((error) => {
    console.log({ message: error.message });
    core.setFailed(error.message);
  });

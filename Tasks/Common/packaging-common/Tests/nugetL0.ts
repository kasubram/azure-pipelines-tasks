import * as assert from "assert";
import * as mockery from "mockery";
import { INuGetXmlHelper } from "../nuget/INuGetXmlHelper";
import { IPackageSourceBase } from "../nuget/Authentication";

class MockedTask {
    private _proxyUrl: string;
    private _proxyUsername: string;
    private _proxyPassword: string;

    public debug(message: string) {}
    public loc(message: string): string { return message; }

    public setMockedValues(proxyUrl?: string, proxyUsername?: string, proxyPassword?: string) {
        this._proxyUrl = proxyUrl;
        this._proxyUsername = proxyUsername;
        this._proxyPassword = proxyPassword;
    }

    public getVariable(name: string) {
        switch (name) {
            case "agent.proxyurl":
                return this._proxyUrl;
            case "agent.proxyusername":
                return this._proxyUsername;
            case "agent.proxypassword":
                return this._proxyPassword;
            case "Task.DisplayName":
                return "NuGet Test"
            default:
                return undefined;
        }
    }
}

var mockedTask: MockedTask = new MockedTask();
var mockedProxy: string = "http://proxy/";
var mockedUsername: string = "mockedUsername";
var mockedPassword: string = "mockedPassword";
mockery.registerMock("vsts-task-lib/task", mockedTask);

export function nugetcommon() {
    beforeEach(() => {
        mockery.enable({
            useCleanCache: true,
            warnOnReplace: false,
            warnOnUnregistered: false
        });
    });

    afterEach(() => {
        mockery.disable();
    });

    it("No HTTP_PROXY", (done: MochaDone) => {
        mockedTask.setMockedValues();
        let ngToolRunner = require("../nuget/NuGetToolRunner");

        let httpProxy: string = ngToolRunner.getNuGetProxyFromEnvironment();
        assert.strictEqual(httpProxy, undefined);

        done();
    });

    it("Finds HTTP_PROXY", (done: MochaDone) => {
        mockedTask.setMockedValues(mockedProxy);
        let ngToolRunner = require("../nuget/NuGetToolRunner");

        let httpProxy: string = ngToolRunner.getNuGetProxyFromEnvironment();
        assert.strictEqual(httpProxy, mockedProxy);

        done();
    });

    it("Finds HTTP_PROXYUSERNAME", (done: MochaDone) => {
        mockedTask.setMockedValues(mockedProxy, mockedUsername);
        let ngToolRunner = require("../nuget/NuGetToolRunner");

        let httpProxy: string = ngToolRunner.getNuGetProxyFromEnvironment();
        assert.strictEqual(httpProxy, `http://${mockedUsername}@proxy/`);

        done();
    });

    it("Finds HTTP_PROXYPASSWORD", (done: MochaDone) => {
        mockedTask.setMockedValues(mockedProxy, mockedUsername, mockedPassword);
        let ngToolRunner = require("../nuget/NuGetToolRunner");

        let httpProxy: string = ngToolRunner.getNuGetProxyFromEnvironment();
        assert.strictEqual(httpProxy, `http://${mockedUsername}:${mockedPassword}@proxy/`);

        done();
    });

    it("getSourcesFromNuGetConfig gets sources", (done: MochaDone) => {    
        let configFile: string;
        mockery.registerMock("fs", {
            readFileSync: () => configFile
        });

        let ngutil = require("../nuget/Utility");

        configFile = '<configuration><packageSources><add key="NameOnly"/><add value="ValueOnly"/><add key="SourceName" value="http://source/"/><add key="SourceCredentials" value="http://credentials"/></packageSources><packageSourceCredentials><SourceCredentials><add key="Username" value="foo"/><add key="ClearTextPassword" value="bar"/></SourceCredentials></packageSourceCredentials></configuration>';

        let sources: IPackageSourceBase[] = ngutil.getSourcesFromNuGetConfig("nuget.config");
        assert.strictEqual(sources.length, 2);
        assert.strictEqual(sources[0].feedName, "SourceName");
        assert.strictEqual(sources[0].feedUri, "http://source/");
        assert.strictEqual(sources[1].feedName, "SourceCredentials");
        assert.strictEqual(sources[1].feedUri, "http://credentials");

        done();
    });

    it("NuGetXmlHelper adds source to NuGetConfig", (done: MochaDone) => {
        let configFile: string;
        mockery.registerMock("fs", {
            readFileSync: () => configFile,
            writeFileSync: (path, content) => { configFile = content; }
        });

        let nugetXmlHelper = require("../nuget/NuGetXmlHelper");
        let helper: INuGetXmlHelper = new nugetXmlHelper.NuGetXmlHelper();

        configFile = "<configuration/>";
        helper.AddSourceToNuGetConfig("SourceName", "http://source/");
        assert.strictEqual(
            configFile,
            '<configuration><packageSources><add key="SourceName" value="http://source/"/></packageSources></configuration>',
            'Helper should have added the "SourceName" source');

        helper.AddSourceToNuGetConfig("SourceCredentials", "http://credentials", "foo", "bar");
        assert.strictEqual(
            configFile,
            '<configuration><packageSources><add key="SourceName" value="http://source/"/><add key="SourceCredentials" value="http://credentials"/></packageSources><packageSourceCredentials><SourceCredentials><add key="Username" value="foo"/><add key="ClearTextPassword" value="bar"/></SourceCredentials></packageSourceCredentials></configuration>',
            'Helper should have added the "SourceCredentials" source with credentials');

        helper.RemoveSourceFromNuGetConfig("SourceCredentials");
        assert.strictEqual(
            configFile,
            '<configuration><packageSources><add key="SourceName" value="http://source/"/></packageSources><packageSourceCredentials/></configuration>',
            'Helper should have removed the "SourceCredentials" source and its credentials');

        assert.throws(() => helper.SetApiKeyInNuGetConfig("http://ApiKeySource/", "ApiKey"), "SetApiKey should throw as it is not currently supported");

        done();
    });

    it("NuGetXmlHelper correctly encodes element names", (done: MochaDone) => {
        let configFile: string;
        mockery.registerMock("fs", {
            readFileSync: () => configFile,
            writeFileSync: (path, content) => { configFile = content; }
        });

        let nugetXmlHelper = require("../nuget/NuGetXmlHelper");
        let helper: INuGetXmlHelper = new nugetXmlHelper.NuGetXmlHelper();

        configFile = "<configuration/>";
        helper.AddSourceToNuGetConfig("1Feed", "http://credentials", "foo", "bar");
        assert.strictEqual(
            configFile,
            '<configuration><packageSources><add key="1Feed" value="http://credentials"/></packageSources><packageSourceCredentials><_x0031_Feed><add key="Username" value="foo"/><add key="ClearTextPassword" value="bar"/></_x0031_Feed></packageSourceCredentials></configuration>',
            'Helper should have added the "1Feed" source with credentials');
        helper.RemoveSourceFromNuGetConfig("1Feed");

        helper.AddSourceToNuGetConfig("Feed with spaces and :", "http://credentials", "foo", "bar");
        assert.strictEqual(
            configFile,
            '<configuration><packageSources><add key="Feed with spaces and :" value="http://credentials"/></packageSources><packageSourceCredentials><Feed_x0020_with_x0020_spaces_x0020_and_x0020__x003a_><add key="Username" value="foo"/><add key="ClearTextPassword" value="bar"/></Feed_x0020_with_x0020_spaces_x0020_and_x0020__x003a_></packageSourceCredentials></configuration>',
            'Helper should have added the "Feed with spaces" source with credentials');
        helper.RemoveSourceFromNuGetConfig("Feed with spaces");

        done();
    });
}

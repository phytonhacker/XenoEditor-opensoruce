const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec, spawn } = require('child_process');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 800,
        minHeight: 600,
        transparent: false,
        frame: true,
        resizable: true,
        backgroundColor: '#3f4447',
        icon: path.join(__dirname, 'icon.png'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false,
            sandbox: false
        }
    });
    
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Project...',
                    accelerator: 'CmdOrCtrl+Shift+N',
                    click: () => {
                        mainWindow.webContents.send('show-new-project');
                    }
                },
                {
                    label: 'Open Folder...',
                    accelerator: 'CmdOrCtrl+O',
                    click: async () => {
                        const result = await dialog.showOpenDialog(mainWindow, {
                            properties: ['openDirectory']
                        });
                        if (!result.canceled && result.filePaths.length > 0) {
                            mainWindow.webContents.send('open-folder', result.filePaths[0]);
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'Save',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => {
                        mainWindow.webContents.send('save-file');
                    }
                },
                { type: 'separator' },
                { role: 'quit', label: 'Exit' }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo', label: 'Undo' },
                { role: 'redo', label: 'Redo' },
                { type: 'separator' },
                { role: 'cut', label: 'Cut' },
                { role: 'copy', label: 'Copy' },
                { role: 'paste', label: 'Paste' },
                { role: 'selectAll', label: 'Select All' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload', label: 'Reload' },
                { role: 'toggleDevTools', label: 'Developer Tools' },
                { type: 'separator' },
                {
                    label: 'Problems',
                    accelerator: 'CmdOrCtrl+Shift+M',
                    click: () => {
                        mainWindow.webContents.send('show-problems');
                    }
                },
                {
                    label: 'Console',
                    accelerator: 'CmdOrCtrl+`',
                    click: () => {
                        mainWindow.webContents.send('toggle-console');
                    }
                },
                { type: 'separator' },
                { role: 'resetZoom', label: 'Reset Zoom' },
                { role: 'zoomIn', label: 'Zoom In' },
                { role: 'zoomOut', label: 'Zoom Out' },
                { type: 'separator' },
                { role: 'togglefullscreen', label: 'Fullscreen' }
            ]
        },
        {
            label: 'Run',
            submenu: [
                {
                    label: 'Run Project',
                    accelerator: 'F5',
                    click: () => {
                        mainWindow.webContents.send('run-project');
                    }
                },
                {
                    label: 'Build Project',
                    accelerator: 'CmdOrCtrl+B',
                    click: () => {
                        mainWindow.webContents.send('build-project');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Analyze Problems',
                    accelerator: 'CmdOrCtrl+Shift+P',
                    click: () => {
                        mainWindow.webContents.send('analyze-problems');
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    
    mainWindow.loadFile('index.html');
}

// Folder dialog
ipcMain.handle('open-folder-dialog', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});

// Create project
ipcMain.handle('create-project', async (event, projectData) => {
    try {
        const { name, location, type, mcVersion, modLoader } = projectData;
        const projectPath = path.join(location, name);
        
        if (!fs.existsSync(projectPath)) {
            fs.mkdirSync(projectPath, { recursive: true });
        }
        
        if (type === 'minecraft-plugin') {
            await createMinecraftPlugin(projectPath, name, mcVersion);
        } else if (type === 'minecraft-mod') {
            await createMinecraftMod(projectPath, name, mcVersion, modLoader);
        } else if (type === 'java') {
            await createJavaProject(projectPath, name);
        } else if (type === 'web') {
            await createWebProject(projectPath, name);
        } else if (type === 'python') {
            await createPythonProject(projectPath, name);
        } else {
            await createEmptyProject(projectPath, name);
        }
        
        return { success: true, path: projectPath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Delete project from disk
ipcMain.handle('delete-project-from-disk', async (event, projectPath) => {
    try {
        if (fs.existsSync(projectPath)) {
            fs.rmSync(projectPath, { recursive: true, force: true });
        }
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Open project in file explorer
ipcMain.handle('open-in-explorer', async (event, projectPath) => {
    try {
        if (fs.existsSync(projectPath)) {
            shell.openPath(projectPath);
            return { success: true };
        } else {
            return { success: false, error: 'Path does not exist' };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Run command - FIXED for gradlew
// Run command - FIXED with better error handling
ipcMain.handle('run-command', async (event, command, cwd) => {
    return new Promise((resolve) => {
        // Ellenőrizzük, hogy a cwd létezik-e
        if (!cwd || !fs.existsSync(cwd)) {
            mainWindow.webContents.send('console-output', { 
                type: 'stderr', 
                data: `Error: Working directory does not exist: ${cwd}\n` 
            });
            resolve(1);
            return;
        }

        const isWindows = process.platform === 'win32';
        let shell, shellFlag, actualCommand;
        
        if (isWindows) {
            shell = 'cmd.exe';
            shellFlag = '/c';
            actualCommand = command;
        } else {
            shell = '/bin/bash';
            shellFlag = '-c';
            actualCommand = command;
        }
        
        console.log(`Running: ${actualCommand} in ${cwd}`);
        mainWindow.webContents.send('console-output', { 
            type: 'info', 
            data: `[Executing in: ${cwd}]\n` 
        });
        
        const child = spawn(shell, [shellFlag, actualCommand], {
            cwd: cwd,
            env: { ...process.env, FORCE_COLOR: '1', JAVA_HOME: process.env.JAVA_HOME || '' },
            windowsHide: true
        });

        let hasOutput = false;
        
        child.stdout.on('data', (data) => {
            hasOutput = true;
            const text = data.toString();
            mainWindow.webContents.send('console-output', { type: 'stdout', data: text });
            parseOutputForProblems(text, cwd);
        });
        
        child.stderr.on('data', (data) => {
            hasOutput = true;
            const text = data.toString();
            mainWindow.webContents.send('console-output', { type: 'stderr', data: text });
            parseOutputForProblems(text, cwd);
        });
        
        child.on('error', (error) => {
            mainWindow.webContents.send('console-output', { 
                type: 'stderr', 
                data: `\n❌ Failed to execute command: ${error.message}\n` 
            });
            
            // Segítség a gyakori hibákhoz
            if (error.message.includes('ENOENT')) {
                mainWindow.webContents.send('console-output', { 
                    type: 'stderr', 
                    data: `\n💡 Tip: The command '${command.split(' ')[0]}' was not found.\n` +
                          `   Make sure Maven/Gradle/Node.js is installed and in your PATH.\n`
                });
            }
            
            resolve(1);
        });
        
        child.on('close', (code) => {
            if (!hasOutput && code !== 0) {
                mainWindow.webContents.send('console-output', { 
                    type: 'stderr', 
                    data: `\n⚠️ Command produced no output. It may not be installed correctly.\n` 
                });
            }
            
            const icon = code === 0 ? '✅' : '❌';
            mainWindow.webContents.send('console-output', { 
                type: code === 0 ? 'info' : 'stderr', 
                data: `\n${icon} [Process exited with code ${code}]\n` 
            });
            mainWindow.webContents.send('command-finished', { code });
            resolve(code);
        });
    });
});

// Parse output for problems
function parseOutputForProblems(text, projectPath) {
    const problems = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
        // Java compilation errors
        const javaErrorMatch = line.match(/^(.+\.java):(\d+):\s*(error|warning):\s*(.+)$/i);
        if (javaErrorMatch) {
            problems.push({
                type: javaErrorMatch[3].toLowerCase(),
                file: javaErrorMatch[1],
                line: parseInt(javaErrorMatch[2]),
                message: javaErrorMatch[4],
                source: 'javac'
            });
        }
        
        // Gradle errors
        const gradleErrorMatch = line.match(/^e:\s*(.+):(\d+):(\d+):\s*(.+)$/i);
        if (gradleErrorMatch) {
            problems.push({
                type: 'error',
                file: gradleErrorMatch[1],
                line: parseInt(gradleErrorMatch[2]),
                column: parseInt(gradleErrorMatch[3]),
                message: gradleErrorMatch[4],
                source: 'gradle'
            });
        }
        
        // Generic error patterns
        const genericErrorMatch = line.match(/^(.+):(\d+):(\d+):\s*(error|warning|Error|Warning):\s*(.+)$/i);
        if (genericErrorMatch && !javaErrorMatch && !gradleErrorMatch) {
            problems.push({
                type: genericErrorMatch[4].toLowerCase(),
                file: genericErrorMatch[1],
                line: parseInt(genericErrorMatch[2]),
                column: parseInt(genericErrorMatch[3]),
                message: genericErrorMatch[5],
                source: 'compiler'
            });
        }
        
        // Python errors
        const pythonErrorMatch = line.match(/File "(.+)", line (\d+)/);
        if (pythonErrorMatch) {
            problems.push({
                type: 'error',
                file: pythonErrorMatch[1],
                line: parseInt(pythonErrorMatch[2]),
                message: 'Python error - see console for details',
                source: 'python'
            });
        }
        
        // ESLint / JavaScript errors
        const eslintMatch = line.match(/^(.+):(\d+):(\d+):\s*(error|warning)\s+(.+)$/i);
        if (eslintMatch) {
            problems.push({
                type: eslintMatch[4].toLowerCase(),
                file: eslintMatch[1],
                line: parseInt(eslintMatch[2]),
                column: parseInt(eslintMatch[3]),
                message: eslintMatch[5],
                source: 'eslint'
            });
        }
        
        // Maven errors
        const mavenErrorMatch = line.match(/\[ERROR\]\s*(.+):(\d+):(\d+):\s*(.+)/);
        if (mavenErrorMatch) {
            problems.push({
                type: 'error',
                file: mavenErrorMatch[1],
                line: parseInt(mavenErrorMatch[2]),
                column: parseInt(mavenErrorMatch[3]),
                message: mavenErrorMatch[4],
                source: 'maven'
            });
        }
        
        // General BUILD FAILED
        if (line.includes('BUILD FAILED') || line.includes('FAILURE')) {
            problems.push({
                type: 'error',
                file: 'Build',
                line: 0,
                message: 'Build failed - check console for details',
                source: 'build'
            });
        }
    }
    
    if (problems.length > 0) {
        mainWindow.webContents.send('problems-found', problems);
    }
}

// Analyze project for problems
ipcMain.handle('analyze-project', async (event, projectPath) => {
    const problems = [];
    
    try {
        // Scan Java files
        const javaFiles = findFiles(projectPath, '.java');
        for (const file of javaFiles) {
            const fileProblems = analyzeJavaFile(file);
            problems.push(...fileProblems);
        }
        
        // Scan JavaScript files
        const jsFiles = findFiles(projectPath, '.js');
        for (const file of jsFiles) {
            const fileProblems = analyzeJsFile(file);
            problems.push(...fileProblems);
        }
        
        // Scan Python files
        const pyFiles = findFiles(projectPath, '.py');
        for (const file of pyFiles) {
            const fileProblems = analyzePyFile(file);
            problems.push(...fileProblems);
        }
        
    } catch (err) {
        console.error('Analysis error:', err);
    }
    
    return problems;
});

function findFiles(dir, extension, files = []) {
    try {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
            const fullPath = path.join(dir, item.name);
            if (item.isDirectory() && !item.name.startsWith('.') && 
                item.name !== 'node_modules' && item.name !== 'target' && 
                item.name !== 'build' && item.name !== '.gradle') {
                findFiles(fullPath, extension, files);
            } else if (item.isFile() && item.name.endsWith(extension)) {
                files.push(fullPath);
            }
        }
    } catch (err) {}
    return files;
}

function analyzeJavaFile(filePath) {
    const problems = [];
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
            const lineNum = index + 1;
            
            if (line.includes('System.out.println') && !line.trim().startsWith('//')) {
                problems.push({
                    type: 'warning',
                    file: filePath,
                    line: lineNum,
                    message: 'Consider using a logger instead of System.out.println',
                    source: 'analyzer'
                });
            }
            
            if (line.match(/catch\s*\([^)]+\)\s*\{\s*\}/)) {
                problems.push({
                    type: 'warning',
                    file: filePath,
                    line: lineNum,
                    message: 'Empty catch block - exceptions should be handled',
                    source: 'analyzer'
                });
            }
            
            if (line.includes('TODO') || line.includes('FIXME')) {
                const match = line.match(/(TODO|FIXME):?\s*(.+)/i);
                problems.push({
                    type: 'info',
                    file: filePath,
                    line: lineNum,
                    message: match ? match[0] : 'TODO/FIXME found',
                    source: 'analyzer'
                });
            }
            
            if (line.includes('@SuppressWarnings')) {
                problems.push({
                    type: 'info',
                    file: filePath,
                    line: lineNum,
                    message: 'SuppressWarnings annotation used - review if necessary',
                    source: 'analyzer'
                });
            }
        });
        
    } catch (err) {}
    return problems;
}

function analyzeJsFile(filePath) {
    const problems = [];
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
            const lineNum = index + 1;
            
            if (line.match(/\bvar\s+/) && !line.trim().startsWith('//')) {
                problems.push({
                    type: 'warning',
                    file: filePath,
                    line: lineNum,
                    message: 'Consider using let or const instead of var',
                    source: 'analyzer'
                });
            }
            
            if (line.includes('console.log') && !line.trim().startsWith('//')) {
                problems.push({
                    type: 'info',
                    file: filePath,
                    line: lineNum,
                    message: 'console.log statement found - remove for production',
                    source: 'analyzer'
                });
            }
            
            if (line.match(/[^=!]==[^=]/) && !line.trim().startsWith('//')) {
                problems.push({
                    type: 'warning',
                    file: filePath,
                    line: lineNum,
                    message: 'Consider using === instead of == for strict equality',
                    source: 'analyzer'
                });
            }
            
            if (line.includes('TODO') || line.includes('FIXME')) {
                problems.push({
                    type: 'info',
                    file: filePath,
                    line: lineNum,
                    message: line.match(/(TODO|FIXME):?\s*(.+)/i)?.[0] || 'TODO/FIXME found',
                    source: 'analyzer'
                });
            }
        });
        
    } catch (err) {}
    return problems;
}

function analyzePyFile(filePath) {
    const problems = [];
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
            const lineNum = index + 1;
            
            if (line.match(/\bprint\s*\(/) && !line.trim().startsWith('#')) {
                problems.push({
                    type: 'info',
                    file: filePath,
                    line: lineNum,
                    message: 'print statement found - consider using logging',
                    source: 'analyzer'
                });
            }
            
            if (line.match(/except\s*:/)) {
                problems.push({
                    type: 'warning',
                    file: filePath,
                    line: lineNum,
                    message: 'Bare except clause - specify exception type',
                    source: 'analyzer'
                });
            }
            
            if (line.includes('TODO') || line.includes('FIXME')) {
                problems.push({
                    type: 'info',
                    file: filePath,
                    line: lineNum,
                    message: line.match(/(TODO|FIXME):?\s*(.+)/i)?.[0] || 'TODO/FIXME found',
                    source: 'analyzer'
                });
            }
        });
        
    } catch (err) {}
    return problems;
}

// ==================== PROJECT CREATION FUNCTIONS ====================

async function createMinecraftPlugin(projectPath, name, mcVersion) {
    const packageName = `com.${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const mainClassName = name.charAt(0).toUpperCase() + name.slice(1).replace(/[^a-zA-Z0-9]/g, '');
    
    const dirs = [
        'src/main/java/' + packageName.replace(/\./g, '/'),
        'src/main/resources'
    ];
    
    dirs.forEach(dir => {
        fs.mkdirSync(path.join(projectPath, dir), { recursive: true });
    });
    
    const pluginYml = `name: ${name}
version: 1.0.0
main: ${packageName}.${mainClassName}
api-version: ${mcVersion}
author: Developer
description: A Minecraft plugin created with XenoEditor

commands:
  ${name.toLowerCase()}:
    description: Main plugin command
    usage: /${name.toLowerCase()}
    permission: ${name.toLowerCase()}.use

permissions:
  ${name.toLowerCase()}.use:
    description: Allows use of the main command
    default: op
`;
    
    fs.writeFileSync(path.join(projectPath, 'src/main/resources/plugin.yml'), pluginYml);
    
    const mainClass = `package ${packageName};

import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.ChatColor;

public class ${mainClassName} extends JavaPlugin {

    @Override
    public void onEnable() {
        getLogger().info("${name} has been enabled!");
    }

    @Override
    public void onDisable() {
        getLogger().info("${name} has been disabled!");
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (command.getName().equalsIgnoreCase("${name.toLowerCase()}")) {
            if (sender instanceof Player) {
                Player player = (Player) sender;
                player.sendMessage(ChatColor.GREEN + "Hello from ${name}!");
            } else {
                sender.sendMessage("${name} plugin is working!");
            }
            return true;
        }
        return false;
    }
}
`;
    
    fs.writeFileSync(
        path.join(projectPath, 'src/main/java', packageName.replace(/\./g, '/'), `${mainClassName}.java`),
        mainClass
    );
    
    const pomXml = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>${packageName}</groupId>
    <artifactId>${name.toLowerCase()}</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>

    <name>${name}</name>

    <properties>
        <java.version>17</java.version>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>

    <repositories>
        <repository>
            <id>spigot-repo</id>
            <url>https://hub.spigotmc.org/nexus/content/repositories/snapshots/</url>
        </repository>
    </repositories>

    <dependencies>
        <dependency>
            <groupId>org.spigotmc</groupId>
            <artifactId>spigot-api</artifactId>
            <version>${mcVersion}-R0.1-SNAPSHOT</version>
            <scope>provided</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>3.11.0</version>
                <configuration>
                    <source>\${java.version}</source>
                    <target>\${java.version}</target>
                </configuration>
            </plugin>
        </plugins>
        <resources>
            <resource>
                <directory>src/main/resources</directory>
                <filtering>true</filtering>
            </resource>
        </resources>
    </build>
</project>
`;
    
    fs.writeFileSync(path.join(projectPath, 'pom.xml'), pomXml);
    fs.writeFileSync(path.join(projectPath, 'README.md'), `# ${name}\n\nMinecraft Plugin for ${mcVersion}\n\n## Build\n\n\`\`\`bash\nmvn clean package\n\`\`\`\n`);
    fs.writeFileSync(path.join(projectPath, '.gitignore'), `target/\n*.class\n*.jar\n.idea/\n*.iml\n`);
}

async function createMinecraftMod(projectPath, name, mcVersion, modLoader) {
    const modId = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const packageName = `com.${modId}`;
    const mainClassName = name.charAt(0).toUpperCase() + name.slice(1).replace(/[^a-zA-Z0-9]/g, '');
    
    if (modLoader === 'forge') {
        await createForgeMod(projectPath, name, modId, packageName, mainClassName, mcVersion);
    } else {
        await createFabricMod(projectPath, name, modId, packageName, mainClassName, mcVersion);
    }
}

async function createForgeMod(projectPath, name, modId, packageName, mainClassName, mcVersion) {
    const dirs = [
        'src/main/java/' + packageName.replace(/\./g, '/'),
        'src/main/resources/META-INF'
    ];
    
    dirs.forEach(dir => {
        fs.mkdirSync(path.join(projectPath, dir), { recursive: true });
    });
    
    const mainClass = `package ${packageName};

import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.event.lifecycle.FMLClientSetupEvent;
import net.minecraftforge.fml.event.lifecycle.FMLCommonSetupEvent;
import net.minecraftforge.fml.javafmlmod.FMLJavaModLoadingContext;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

@Mod("${modId}")
public class ${mainClassName} {
    
    private static final Logger LOGGER = LogManager.getLogger();
    public static final String MOD_ID = "${modId}";

    public ${mainClassName}() {
        FMLJavaModLoadingContext.get().getModEventBus().addListener(this::setup);
        FMLJavaModLoadingContext.get().getModEventBus().addListener(this::clientSetup);
    }

    private void setup(final FMLCommonSetupEvent event) {
        LOGGER.info("${name} is loading!");
    }

    private void clientSetup(final FMLClientSetupEvent event) {
        LOGGER.info("${name} client setup complete!");
    }
}
`;
    
    fs.writeFileSync(
        path.join(projectPath, 'src/main/java', packageName.replace(/\./g, '/'), `${mainClassName}.java`),
        mainClass
    );
    
    const modsToml = `modLoader="javafml"
loaderVersion="[43,)"
license="All Rights Reserved"

[[mods]]
modId="${modId}"
version="1.0.0"
displayName="${name}"
description='''
A Minecraft Forge mod created with XenoEditor.
'''
`;
    
    fs.writeFileSync(path.join(projectPath, 'src/main/resources/META-INF/mods.toml'), modsToml);
    
    const buildGradle = `plugins {
    id 'net.minecraftforge.gradle' version '5.1.+'
}

version = '1.0.0'
group = '${packageName}'
archivesBaseName = '${modId}'

java.toolchain.languageVersion = JavaLanguageVersion.of(17)

minecraft {
    mappings channel: 'official', version: '${mcVersion}'
    
    runs {
        client {
            workingDirectory project.file('run')
            property 'forge.logging.console.level', 'debug'
            mods {
                ${modId} {
                    source sourceSets.main
                }
            }
        }
        server {
            workingDirectory project.file('run')
            property 'forge.logging.console.level', 'debug'
            mods {
                ${modId} {
                    source sourceSets.main
                }
            }
        }
    }
}

dependencies {
    minecraft 'net.minecraftforge:forge:${mcVersion}-43.2.0'
}
`;
    
    fs.writeFileSync(path.join(projectPath, 'build.gradle'), buildGradle);
    
    fs.writeFileSync(path.join(projectPath, 'settings.gradle'), `pluginManagement {
    repositories {
        gradlePluginPortal()
        maven { url = 'https://maven.minecraftforge.net/' }
    }
}
rootProject.name = '${modId}'
`);
    
    fs.writeFileSync(path.join(projectPath, 'gradle.properties'), `org.gradle.jvmargs=-Xmx3G
org.gradle.daemon=false
`);
    
    await createGradleWrapper(projectPath);
    
    fs.writeFileSync(path.join(projectPath, 'README.md'), `# ${name}\n\nMinecraft Forge Mod for ${mcVersion}\n\n## Build\n\n\`\`\`bash\n./gradlew build\n\`\`\`\n`);
    fs.writeFileSync(path.join(projectPath, '.gitignore'), `build/\nrun/\n.gradle/\n.idea/\n*.iml\n`);
}

async function createFabricMod(projectPath, name, modId, packageName, mainClassName, mcVersion) {
    const dirs = [
        'src/main/java/' + packageName.replace(/\./g, '/'),
        'src/main/resources'
    ];
    
    dirs.forEach(dir => {
        fs.mkdirSync(path.join(projectPath, dir), { recursive: true });
    });
    
    const mainClass = `package ${packageName};

import net.fabricmc.api.ModInitializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class ${mainClassName} implements ModInitializer {
    
    public static final String MOD_ID = "${modId}";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    @Override
    public void onInitialize() {
        LOGGER.info("${name} has been initialized!");
    }
}
`;
    
    fs.writeFileSync(
        path.join(projectPath, 'src/main/java', packageName.replace(/\./g, '/'), `${mainClassName}.java`),
        mainClass
    );
    
    fs.writeFileSync(path.join(projectPath, 'src/main/resources/fabric.mod.json'), JSON.stringify({
        schemaVersion: 1,
        id: modId,
        version: "1.0.0",
        name: name,
        description: "A Minecraft Fabric mod",
        authors: ["Developer"],
        license: "All-Rights-Reserved",
        environment: "*",
        entrypoints: { main: [`${packageName}.${mainClassName}`] },
        depends: { fabricloader: ">=0.14.0", minecraft: mcVersion, java: ">=17" }
    }, null, 2));
    
    fs.writeFileSync(path.join(projectPath, 'build.gradle'), `plugins {
    id 'fabric-loom' version '1.0-SNAPSHOT'
}

version = "1.0.0"
group = "${packageName}"

dependencies {
    minecraft "com.mojang:minecraft:${mcVersion}"
    mappings "net.fabricmc:yarn:${mcVersion}+build.1:v2"
    modImplementation "net.fabricmc:fabric-loader:0.14.21"
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}
`);
    
    fs.writeFileSync(path.join(projectPath, 'settings.gradle'), `pluginManagement {
    repositories {
        maven { url = 'https://maven.fabricmc.net/' }
        mavenCentral()
        gradlePluginPortal()
    }
}
rootProject.name = '${modId}'
`);
    
    await createGradleWrapper(projectPath);
    
    fs.writeFileSync(path.join(projectPath, 'README.md'), `# ${name}\n\nFabric Mod for ${mcVersion}\n`);
    fs.writeFileSync(path.join(projectPath, '.gitignore'), `build/\nrun/\n.gradle/\n.idea/\n`);
}

async function createGradleWrapper(projectPath) {
    fs.mkdirSync(path.join(projectPath, 'gradle', 'wrapper'), { recursive: true });
    
    const gradlewUnix = `#!/bin/sh
##############################################################################
# Gradle start up script for POSIX generated by XenoEditor
##############################################################################

APP_BASE_NAME=\`basename "$0"\`
APP_HOME="\`pwd -P\`"

DEFAULT_JVM_OPTS='"-Xmx64m" "-Xms64m"'

CLASSPATH=$APP_HOME/gradle/wrapper/gradle-wrapper.jar

exec java $DEFAULT_JVM_OPTS -classpath "$CLASSPATH" org.gradle.wrapper.GradleWrapperMain "$@"
`;
    
    fs.writeFileSync(path.join(projectPath, 'gradlew'), gradlewUnix);
    fs.chmodSync(path.join(projectPath, 'gradlew'), '755');
    
    const gradlewBat = `@rem Gradle startup script for Windows
@if "%DEBUG%"=="" @echo off
setlocal

set DIRNAME=%~dp0
set APP_BASE_NAME=%~n0
set APP_HOME=%DIRNAME%

set DEFAULT_JVM_OPTS="-Xmx64m" "-Xms64m"

set CLASSPATH=%APP_HOME%\\gradle\\wrapper\\gradle-wrapper.jar

java %DEFAULT_JVM_OPTS% -classpath "%CLASSPATH%" org.gradle.wrapper.GradleWrapperMain %*

:end
endlocal
`;
    
    fs.writeFileSync(path.join(projectPath, 'gradlew.bat'), gradlewBat);
    
    const wrapperProps = `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.1.1-bin.zip
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`;
    
    fs.writeFileSync(path.join(projectPath, 'gradle', 'wrapper', 'gradle-wrapper.properties'), wrapperProps);
}

async function createJavaProject(projectPath, name) {
    const packageName = `com.${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    
    fs.mkdirSync(path.join(projectPath, 'src/main/java', packageName.replace(/\./g, '/')), { recursive: true });
    fs.mkdirSync(path.join(projectPath, 'src/main/resources'), { recursive: true });
    
    fs.writeFileSync(
        path.join(projectPath, 'src/main/java', packageName.replace(/\./g, '/'), 'Main.java'),
        `package ${packageName};\n\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from ${name}!");\n    }\n}\n`
    );
    
    fs.writeFileSync(path.join(projectPath, 'pom.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <groupId>${packageName}</groupId>
    <artifactId>${name.toLowerCase()}</artifactId>
    <version>1.0.0</version>
    <properties>
        <java.version>17</java.version>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>
    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>3.11.0</version>
                <configuration>
                    <source>\${java.version}</source>
                    <target>\${java.version}</target>
                </configuration>
            </plugin>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-jar-plugin</artifactId>
                <version>3.3.0</version>
                <configuration>
                    <archive>
                        <manifest>
                            <mainClass>${packageName}.Main</mainClass>
                        </manifest>
                    </archive>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>
`);
    
    fs.writeFileSync(path.join(projectPath, 'README.md'), `# ${name}\n\nJava Project\n`);
    fs.writeFileSync(path.join(projectPath, '.gitignore'), `target/\n*.class\n.idea/\n`);
}

async function createWebProject(projectPath, name) {
    fs.mkdirSync(path.join(projectPath, 'css'), { recursive: true });
    fs.mkdirSync(path.join(projectPath, 'js'), { recursive: true });
    
    fs.writeFileSync(path.join(projectPath, 'index.html'), `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${name}</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <h1>Welcome to ${name}</h1>
    <script src="js/main.js"></script>
</body>
</html>
`);
    
    fs.writeFileSync(path.join(projectPath, 'css/style.css'), `* { margin: 0; padding: 0; box-sizing: border-box; }\nbody { font-family: sans-serif; padding: 20px; }\n`);
    fs.writeFileSync(path.join(projectPath, 'js/main.js'), `console.log('${name} loaded!');\n`);
    fs.writeFileSync(path.join(projectPath, 'README.md'), `# ${name}\n\nWeb Project\n`);
}

async function createPythonProject(projectPath, name) {
    const moduleName = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    fs.mkdirSync(path.join(projectPath, moduleName), { recursive: true });
    
    fs.writeFileSync(path.join(projectPath, 'main.py'), `#!/usr/bin/env python3\n"""${name} - Main entry point"""\n\ndef main():\n    print("Hello from ${name}!")\n\nif __name__ == "__main__":\n    main()\n`);
    fs.writeFileSync(path.join(projectPath, moduleName, '__init__.py'), `"""${name} package"""\n__version__ = "1.0.0"\n`);
    fs.writeFileSync(path.join(projectPath, 'requirements.txt'), '# Add dependencies here\n');
    fs.writeFileSync(path.join(projectPath, 'README.md'), `# ${name}\n\nPython Project\n`);
    fs.writeFileSync(path.join(projectPath, '.gitignore'), `__pycache__/\n*.pyc\nvenv/\n.env\n`);
}

async function createEmptyProject(projectPath, name) {
    fs.mkdirSync(path.join(projectPath, 'src'), { recursive: true });
    fs.writeFileSync(path.join(projectPath, 'README.md'), `# ${name}\n`);
    fs.writeFileSync(path.join(projectPath, '.gitignore'), `# Add files to ignore\n`);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
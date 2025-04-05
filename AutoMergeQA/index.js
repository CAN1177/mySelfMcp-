/*

功能: 更新和合并分支
假设当前分支是 dev_test
1. 更新 master 并合入到 dev_test, push dev_test 分支
2. 更新 qa 并切换到 qa 分支, 把 dev_test 分支合并到 qa 分支, push qa 分支, 切换回 dev_test 分支

运行方法1, 列出以 qa 开头的所有分支, 然后手动选择 qa 分支:
node qaReleaseTool.js

运行方法2, 运行时添加参数指定分支 (使用 -b 或者 --branch 参数):
node qaReleaseTool.js -b=qa_test2
node qaReleaseTool.js --branch=qa_test2

清除临时缓存:
node qaReleaseTool.js -c

查看发布次数统计:
node qaReleaseTool.js -s        

运行之前请尽量保证工作区干净
如果遇到无法自动处理的冲突, 会打印报错并合并失败, 需要手动合并

 */

const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');

const masterBranch = 'master';
const cacheFilePath = path.join(os.tmpdir(), 'qa_branches_cache.json');
const homeDir = os.homedir();
const statsFilePath = path.join(homeDir, 'release_stats.json');

function listQABranches() {
    execSync('git fetch');

    const branches = execSync('git branch -r').toString().split('\n')
        .map(branch => branch.trim().replace('origin/', ''))
        .filter(branch => branch.startsWith('qa'));

    let cache = {};
    if (fs.existsSync(cacheFilePath)) {
        cache = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
    }

    branches.forEach(branch => {
        if (!cache[branch]) {
            cache[branch] = { lastTime: 0 };
        }
    });

    const sortedBranches = branches.sort((a, b) => (cache[b].lastTime || 0) - (cache[a].lastTime || 0));

    console.log('请选择一个 qa 分支:');
    sortedBranches.forEach((branch, index) => {
        console.log(`\x1b[32m${index + 1}. ${branch}\x1b[0m`);
    });

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question('输入分支编号: ', (answer) => {
            const choice = parseInt(answer, 10);
            const selectedBranch = sortedBranches[choice - 1];

            if (selectedBranch) {
                cache[selectedBranch] = {
                    lastTime: Date.now()
                };
                fs.writeFileSync(cacheFilePath, JSON.stringify(cache, null, 2));
                resolve(selectedBranch);
            } else {
                console.log('无效选择');
                process.exit(1);
            }
            rl.close();
        });
    });
}

function clearCache() {
    if (fs.existsSync(cacheFilePath)) {
        fs.unlinkSync(cacheFilePath);
        console.log('缓存已清除');
    } else {
        console.log('没有找到缓存文件');
    }
}

function updateReleaseStats(duration) {
    let stats = {};
    if (fs.existsSync(statsFilePath)) {
        stats = JSON.parse(fs.readFileSync(statsFilePath, 'utf8'));
    }

    const newKey = Object.keys(stats).length + 1;
    stats[newKey] = (duration / 1000).toFixed(3) + 's';

    fs.writeFileSync(statsFilePath, JSON.stringify(stats, null, 2));
}

function printReleaseStats() {
    if (!fs.existsSync(statsFilePath)) {
        console.log('没有找到发布统计文件');
        return;
    }

    const stats = JSON.parse(fs.readFileSync(statsFilePath, 'utf8'));
    
    if (Object.keys(stats).length === 0) {
        console.log('发布统计文件为空');
        return;
    }

    console.log('发布次数统计:');
    console.table(stats);
}

async function main() {
    if (process.argv.includes('-c')) {
        clearCache();
        return;
    }

    if (process.argv.includes('-s')) {
        printReleaseStats();
        return;
    }

    const startTime = Date.now();  // 开始计时
    console.time('总运行耗时');
    const curBranch = execSync(`git branch --show-current`).toString().trim();
    let targetBranch = getTargetBranch();

    if (!detectBranchParam()) {
        targetBranch = await listQABranches();
    }

    console.log(`当前分支`, curBranch);
    console.log(`目标分支`, targetBranch);

    if (curBranch === targetBranch) {
        console.log('分支一致, 无需处理');
        return;
    }
    if (curBranch.startsWith('qa')) {
        console.log(`当前已在 qa 分支 (${curBranch}), 请检查当前分支`);
        return;
    }

    const mergeAbort = 'git merge --abort'

    const cmdList = [
        `git fetch origin refs/heads/${masterBranch}:refs/heads/${masterBranch} --recurse-submodules=no --progress`,
        `git merge refs/heads/${masterBranch}`,
        `git push origin refs/heads/${curBranch}:${curBranch}`,

        `git fetch origin refs/heads/${targetBranch}:refs/heads/${targetBranch} --recurse-submodules=no --progress`,
        `git checkout ${targetBranch}`,
        `git merge refs/heads/${curBranch}`,
        `git push origin refs/heads/${targetBranch}:${targetBranch}`,

        `git checkout ${curBranch}`,
    ];

    for (let i = 0; i < cmdList.length; i++) {
        let cmd = cmdList[i];
        console.log('\n' + '-'.repeat(100))
        console.log(cmd, '\n');
        try {
            let res = await execSync(cmd);
            if (res.toString()) {
                console.log(res.toString());
            }
        } catch (e) {
            if (e.stdout.toString()) {
                console.log('报错信息:', e.stdout.toString());
            }
            if (e.stderr.toString()) {
                console.log('报错信息:', e.stderr.toString());
            }
            console.log(`命令 ${cmd} 执行失败, 请手动发布到 ${targetBranch} 分支`);
            if (cmd.startsWith('git merge ')) {
                await execSync(mergeAbort)
                console.log('检测到存在合并冲突, 请先手动解决冲突');
            }
            return;
        }
    }
    console.timeEnd('总运行耗时');
    const duration = Date.now() - startTime;  // 计算耗时
    updateReleaseStats(duration);
    console.log('\x1b[42;30m DONE \x1b[40;32m ' + `发布到 ${targetBranch} 分支成功!` + '\x1b[0m');
}

main();

function detectBranchParam() {
    const key = '-b=';
    const key2 = '--branch=';
    const branchParams = process.argv.slice(2).find(d => d.startsWith(key));
    const branchParams2 = process.argv.slice(2).find(d => d.startsWith(key2));
    return branchParams || branchParams2;
}

function getTargetBranch() {
    let targetBranch = 'qa';
    const branchParam = detectBranchParam();
    if (branchParam) {
        const key = branchParam.startsWith('-b=') ? '-b=' : '--branch=';
        targetBranch = branchParam.slice(key.length);
    }
    return targetBranch;
}

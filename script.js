document.getElementById('downloadButton').addEventListener('click', startDownload);

async function startDownload() {
    const imageLinks = document.getElementById('imageLinks').value.split('\n').filter(link => link.trim() !== '');
    const total = imageLinks.length;

    if (total === 0) {
        alert("请输入至少一个图片链接！");
        return;
    }

    let success = 0;
    let failure = 0;
    const failedLinks = [];

    const progressBar = document.getElementById('progressBar');
    const successBar = progressBar.querySelector('.success');
    const failureBar = progressBar.querySelector('.failure');
    const pendingBar = progressBar.querySelector('.pending');

    const stats = document.getElementById('stats');
    const downloadButton = document.getElementById('downloadButton');
    const failedLinksTextarea = document.getElementById('failedLinks');

    downloadButton.disabled = true;
    stats.innerHTML = `<span style="color: #4CAF50;">成功: 0</span> | <span style="color: #f44336;">失败: 0</span> | <span>总数: ${total}</span>`;
    failedLinksTextarea.value = "";

    console.log("开始批量下载任务，总图片数量：", total);

    try {
        const zip = new JSZip(); // 创建一个 ZIP 文件

        // 限制并发下载数量为 5
        const batchSize = 5;
        for (let i = 0; i < total; i += batchSize) {
            const batch = imageLinks.slice(i, i + batchSize);
            await Promise.allSettled(
                batch.map(async (url, index) => {
                    try {
                        console.log(`正在处理第 ${i + index + 1} 个链接：${url}`);
                        const parsedUrl = new URL(url);
                        console.log(`解析后的 URL：${parsedUrl.href}`);

                        const response = await fetchWithFallback(parsedUrl.href);
                        const text = await response.text();
                        console.log(`获取页面内容成功，内容长度：${text.length}`);

                        const imgUrlMatch = text.match(/image_src" href="(.*)"/);
                        if (imgUrlMatch && imgUrlMatch[1]) {
                            const imgUrl = imgUrlMatch[1];
                            console.log(`提取图片 URL 成功：${imgUrl}`);

                            const imgResponse = await fetchWithFallback(imgUrl);
                            const blob = await imgResponse.blob();
                            console.log(`获取图片成功，文件大小：${blob.size} 字节`);

                            const imgName = imgUrl.substring(imgUrl.lastIndexOf('/') + 1);
                            console.log(`提取文件名成功：${imgName}`);

                            // 将图片添加到 ZIP 文件中
                            zip.file(imgName, blob);
                            success++;
                            console.log(`图片已添加到 ZIP 文件：${imgName}`);
                        } else {
                            console.warn(`无法从页面内容中提取图片 URL：${url}`);
                            failure++;
                            failedLinks.push(url);
                        }
                    } catch (error) {
                        console.error(`处理链接 ${url} 时发生错误：`, error);
                        failure++;
                        failedLinks.push(url);
                    } finally {
                        updateProgress(success, failure, total, successBar, failureBar, pendingBar, stats);
                        failedLinksTextarea.value = failedLinks.join('\n');
                    }
                })
            );
        }

        // 生成 ZIP 文件并触发下载
        const zipBlob = await zip.generateAsync({ type: "blob" });
        // saveAs(zipBlob, "images.zip"); // 使用 FileSaver.js 触发下载
        const fileName = `images_${success}_${failure}_${total}.zip`; // 动态生成文件名
        saveAs(zipBlob, fileName); // 使用 FileSaver.js 触发下载

        console.log("批量下载任务完成！");
        alert("下载完成！");
    } catch (error) {
        console.error("批量下载任务失败：", error);
        alert("下载失败！");
        failure = total;
        updateProgress(success, failure, total, successBar, failureBar, pendingBar, stats);
    } finally {
        downloadButton.disabled = false;
        console.log("下载按钮已解锁");
    }
}

// 封装 fetch 逻辑，支持主请求失败时使用代理服务器作为备用方案
async function fetchWithFallback(url) {
    try {
        console.log(`尝试直接请求目标 URL：${url}`);
        const response = await fetch(url);
        if (!response.ok) throw new Error("请求失败，状态码：" + response.status);
        console.log(`直接请求成功：${url}`);
        return response;
    } catch (error) {
        console.log(`直接请求失败，尝试使用代理服务器：${url}`);
        const fallbackResponse = await fetch(`https://api.codetabs.com/v1/proxy/?quest=${url}`);
        if (!fallbackResponse.ok) throw new Error("代理请求失败，状态码：" + fallbackResponse.status);
        console.log(`代理请求成功：${url}`);
        return fallbackResponse;
    }
}

// 更新进度条和统计信息
function updateProgress(success, failure, total, successBar, failureBar, pendingBar, stats) {
    successBar.style.width = `${(success / total) * 100}%`;
    failureBar.style.width = `${(failure / total) * 100}%`;
    pendingBar.style.width = `${((total - success - failure) / total) * 100}%`;
    stats.innerHTML = `<span style="color: #4CAF50;">成功: ${success}</span> | <span style="color: #f44336;">失败: ${failure}</span> | <span>总数: ${total}</span>`;
    console.log(`更新进度：成功 ${success}，失败 ${failure}，总数 ${total}`);
}
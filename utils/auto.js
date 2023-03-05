const logger = require("./logger.js");
const metadata = require("./metadata.js")
const ytdlp = require("./ytdlp.js")
const redis = require("./redis.js")
const websocket = require("./websocket.js")

const { PrismaClient } =  require('@prisma/client')
const prisma = new PrismaClient()

async function handleCheck() {
    const channels = await prisma.autodownload.findMany()

    for (c of channels) {
        await handleDownload(c.channel)
    }
}

async function handleDownload(channelId) {
    logger.info({ message: `Checking ${channelId} for new videos...` })

    const instance = await metadata.getInstance()
    const channel = await metadata.getChannelVideos(instance, channelId)
    for (video of channel.relatedStreams) {
        const id = video.url.match(/[?&]v=([^&]+)/)[1]

        const already = await prisma.videos.findFirst({
            where: {
                id: id
            }
        })

        if (already) continue
        logger.info({ message: `Starting to download ${video.title}, ${id}` })

        const download = await ytdlp.downloadVideo('https://www.youtube.com' + video.url)
        if (download.fail) {
            logger.info({ message: `Failed downloading ${video.title}, ${id} -> ${download.message}` })
            await redis.del(id)
            continue
        } else {
            await redis.del(id)

            const file = fs.readdirSync("./videos").find(f => f.includes(id))
            if (file) {
                fs.renameSync(`./videos/${file}`, `./videos/${id}.webm`)
                logger.info({ message: `Downloaded ${video.title}, ${id}` })

                const videoUrl = await upload.uploadVideo(`./videos/${id}.webm`)
                logger.info({ message: `Uploaded ${video.title}, ${id}` })
                fs.unlinkSync(`./videos/${id}.webm`)

                await websocket.createDatabaseVideo(id, videoUrl)
            } else {
                logger.info({ message: `Couldn't find file for ${video.title}, ${id}` })
                continue
            }
        }
    }
}

module.exports = { handleCheck }
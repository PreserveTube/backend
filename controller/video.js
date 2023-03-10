const { PrismaClient } =  require('@prisma/client')
const prisma = new PrismaClient()

const DOMPurify = require('isomorphic-dompurify')
const metadata = require('../utils/metadata.js')

exports.getVideo = async (req, res) => {
    const info = await prisma.videos.findFirst({
        where: {
            id: req.params.id
        },
        select: {
            title: true,
            description: true,
            thumbnail: true,
            source: true,
            published: true,
            archived: true,
            channel: true, 
            channelId: true, 
            channelAvatar: true,
            channelVerified: true,
            disabled: true
        }
    })
    
    if (!info) return res.json({ error: '404' })

    res.json({
        ...info,
        description: DOMPurify.sanitize(info.description),
    })
}

exports.getChannel = async (req, res) => {
    const instance = await metadata.getInstance()
    const videos = await metadata.getChannelVideos(instance, req.params.id)
    if (videos.error) return res.json({ error: '404' })

    const archived = await prisma.videos.findMany({
        where: {
            channelId: req.params.id
        }, 
        select: {
            id: true,
            title: true,
            thumbnail: true,
            published: true,
            archived: true
        }
    })

    var allVideos = []
    allVideos = allVideos.concat((videos.relatedStreams).map(video => {
        return { 
            id: video.url.replace('/watch?v=', ''),
            published: (new Date(video.uploaded)).toISOString().slice(0,10),
            ...video
        }
    }))

    await Promise.all(archived.map(async (v) => {
        const allVideo = allVideos.find(o => o.id == v.id)
        if (allVideo) {
            const index = allVideos.findIndex(o => o.id == v.id)
            allVideos[index] = v
        } else {
            const live = await metadata.getVideoMetadata(instance, v.id)

            allVideos.push({
                ...v, 
                deleted: live.error ? true : false
            })
        }
    }))

    allVideos.sort((a, b) => new Date(b.published) - new Date(a.published))

    res.json({
        name: videos.name, 
        avatar: videos.avatarUrl,
        verified: videos.verified,
        videos: allVideos 
    })
}

exports.getPlaylist = async (req, res) => {
    const instance = await metadata.getInstance()
    const playlist = await metadata.getPlaylistVideos(instance, req.params.id)
    if (playlist.error) return res.json({ error: '404' })

    const playlistArchived = await prisma.videos.findMany({
        where: {
            playlist: req.params.id
        }, 
        select: {
            id: true,
            title: true,
            thumbnail: true,
            published: true,
            archived: true
        }
    })

    var allVideos = []
    allVideos = allVideos.concat((playlist.relatedStreams).map(video => {
        return { 
            id: video.url.replace('/watch?v=', ''),
            published: (new Date(video.uploaded)).toISOString().slice(0,10),
            ...video
        }
    }))

    await Promise.all(playlistArchived.map(async (v) => {
        const allVideo = allVideos.find(o => o.id == v.id)
        if (allVideo) {
            const index = allVideos.findIndex(o => o.id == v.id)
            allVideos[index] = v
        } else {
            const live = await metadata.getVideoMetadata(instance, v.id)

            allVideos.push({
                ...v, 
                deleted: live.error ? true : false
            })
        }
    }))

    await Promise.all(allVideos.map(async (v) => {
        if (!v.archived) {
            const video = await prisma.videos.findFirst({
                where: {
                    id: v.id
                }, 
                select: {
                    id: true,
                    title: true,
                    thumbnail: true,
                    published: true,
                    archived: true
                }
            })

            if (video) {
                const index = allVideos.findIndex(o => o.id == v.id)
                allVideos[index] = video
            }
        }
    }))

    allVideos.sort((a, b) => new Date(a.published) - new Date(b.published))

    res.json({
        name: playlist.name,
        channel: playlist.uploader, 
        url: playlist.uploaderUrl,
        avatar: playlist.uploaderAvatar,
        videos: allVideos 
    })
}
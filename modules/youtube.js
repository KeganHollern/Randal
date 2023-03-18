import yts from 'yt-search';
import youtubedl from 'youtube-dl-exec';




const stream_audio = (url) => {
    console.log(`streaming from ${url}`);
    // youtubedl.create("/path/to/yt-dlp").exec()
    const stream = youtubedl.exec(url, {
        output: '-', // pipe to stdout
        quiet: true, // quiet
        format: '251', // some unknown format - works so don't change
        limitRate: '100K', // 100K bitrate
    }, { stdio: ['ignore', 'pipe', 'ignore'] }) // stdin, stdout, stderr ?

    return stream.stdout;
}

const find = async (query) => {
    const results = await yts(query);
    const vids = results.videos.slice(0,3);
    const playlists = results.playlists.slice(0,3);
    return {
        videos: vids,
        playlists: playlists
    };
}
const find_video = async(query) => {
    return (await search(query)).videos[0]
}
const find_playlist = async(query) => {
    return (await search(query)).playlists[0]
}

const get_playlist_videos = async(playlist) => {
    const playlistId = playlist.listId;
    const playlist_search = await yts({listId: playlistId});
    
    let promises = [];
    playlist_search.videos.forEach((video) => {
        let id = video.videoId;
        promises.push(yts({videoId: videoId}));
    });
    let results = await Promise.allSettled(promises);
    let response = results.map((entry) => entry.value);
    return response;
}



export { stream_audio, find, find_video, find_playlist, get_playlist_videos }
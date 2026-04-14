type TopicCard = { icon: string; title: string; description: string; link: string };

export async function fetchTopics(): Promise<TopicCard[]> {
    const FORUM_ORIGIN = "https://forum.sparcles.dev";
    const LATEST_TOPICS = "/latest.json?order=created&ascending=false";

    const SINGLE_POST = (id: number) => `/posts/${id}.json`;
    const SINGLE_TOPIC = (id: number) => `/t/${id}.json`;

    const safeFetchJson = async (url: URL, init?: RequestInit) => {
        const res = await fetch(url, init);
        if (!res.ok) {
            throw new Error(`Request failed: ${res.status} ${res.statusText}`);
        }
        return res.json();
    };

    const parseThumbnail = async (postId: number) => {
        const postData = await safeFetchJson(new URL(SINGLE_POST(postId), FORUM_ORIGIN));
        const raw = typeof postData?.raw === "string" ? postData.raw : "";
        const match = raw.match(/\[comment\]: <(.*?)>/);
        return match ? match[1] : "";
    };

    const parseTopic = async (topic: any): Promise<TopicCard> => {
        const title = String(topic?.title ?? "");
        const imageUrl = typeof topic?.image_url === "string" ? topic.image_url : "";
        const icon = imageUrl.startsWith("https:") ? imageUrl : imageUrl ? `https:${imageUrl}` : "";
        const slug = String(topic?.slug ?? "");
        const id = Number(topic?.id);
        const link = `${FORUM_ORIGIN}/t/${slug}/${id}`;

        const firstPostId = Number(topic?.post_stream?.posts?.[0]?.id);
        const thumbnail = Number.isFinite(firstPostId) ? await parseThumbnail(firstPostId) : "";

        return { icon, title, description: thumbnail, link };
    };

    try {
        const data = await safeFetchJson(new URL(LATEST_TOPICS, FORUM_ORIGIN), {
            headers: {
                accept: "application/json",
            },
        });

        const topics = Array.isArray(data?.topic_list?.topics) ? data.topic_list.topics : [];

        const parsedTopics: TopicCard[] = [];
        for (const topic of topics) {
            if (parsedTopics.length === 2) break;

            const topicId = Number(topic?.id);
            if (!Number.isFinite(topicId)) continue;

            const topicDetails = await safeFetchJson(new URL(SINGLE_TOPIC(topicId), FORUM_ORIGIN));
            if (topicDetails?.category_id === 7) {
                parsedTopics.push(await parseTopic(topicDetails));
            }
        }

        return parsedTopics;
    } catch (error) {
        // Build should never fail just because the forum is unreachable.
        // Keep errors visible during local dev, but avoid noisy production builds.
        if (process.env.NODE_ENV !== "production") {
            console.error("Error fetching topics:", error);
        }
        return [];
    }
}

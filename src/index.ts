import { toConfig, createPage } from "roam-client";

const CONFIG = toConfig("smartblocks");
createPage({ title: CONFIG });

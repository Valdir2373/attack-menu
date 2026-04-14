import aiohttp
from typing import Dict, List, Union
from application.proxy.IHttpClient import IHttpClient, HttpForwardRequest, HttpForwardResponse


class AiohttpHttpClient(IHttpClient):
    async def forward(self, req: HttpForwardRequest) -> HttpForwardResponse:
        timeout = aiohttp.ClientTimeout(total=20)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.request(
                method=req.method,
                url=req.url,
                headers={k: v for k, v in req.headers.items() if v},
                data=req.body,
                allow_redirects=False,
                ssl=False,
            ) as resp:
                body = await resp.read()
                content_type = resp.content_type or ""

                headers: Dict[str, Union[str, List[str]]] = {}
                for k, v in resp.headers.items():
                    lk = k.lower()
                    if lk == "set-cookie":
                        existing = headers.get("set-cookie")
                        if existing is None:
                            headers["set-cookie"] = v
                        elif isinstance(existing, list):
                            existing.append(v)
                        else:
                            headers["set-cookie"] = [existing, v]
                    else:
                        headers[lk] = v

                return HttpForwardResponse(
                    status=resp.status,
                    headers=headers,
                    body=body,
                    content_type=content_type,
                )

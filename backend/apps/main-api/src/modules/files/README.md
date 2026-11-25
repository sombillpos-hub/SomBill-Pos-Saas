# files

Uploads shared by several modules (menu images, branding, expense attachments, documents). Added to the 35 business
modules on 23 Nov 2026 because uploads are a cross-module capability: keeping them in one place gives one set of
size/type checks, one storage provider and one authorization rule per purpose. The bytes are kept by the
`@sombill/storage` provider; metadata is the `stored_files` table (organization database).

| Method | Path                                        | Notes                                                                     |
| ------ | ------------------------------------------- | ------------------------------------------------------------------------- |
| POST   | `/files`                                    | multipart: `file`, `organizationId`, `purpose`, optional `branchId` → 201 |
| GET    | `/files?organizationId=&purpose=&branchId=` | paged list                                                                |
| GET    | `/files/:fileId`                            | metadata                                                                  |
| GET    | `/files/:fileId/content`                    | the bytes, with the stored content type                                   |
| DELETE | `/files/:fileId`                            | 204                                                                       |

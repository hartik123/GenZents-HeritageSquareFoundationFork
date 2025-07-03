import { supabase } from "@/lib/supabase/client"
import type { Version, Change } from "@/lib/types"

export class VersionControl {
  static async createVersion(title: string, description: string, changes: Partial<Change>[] = []): Promise<string> {
    const { data: currentVersions } = await supabase
      .from("versions")
      .select("version")
      .order("version", { ascending: false })
      .limit(1)

    const currentVersion = currentVersions?.[0]?.version || "1.0.0"
    const versionParts = currentVersion.split(".").map((n: string) => parseInt(n))
    const nextVersion = `${versionParts[0]}.${versionParts[1]}.${versionParts[2] + 1}`

    const { data: version, error } = await supabase
      .from("versions")
      .insert({
        version: nextVersion,
        title,
        description,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        timestamp: new Date().toISOString(),
        status: "current",
        data: { changes },
      })
      .select()
      .single()

    if (error) throw error

    if (changes.length > 0) {
      const changeRecords = changes.map((change) => ({
        version_id: version.id,
        type: change.type || "modified",
        original_path: change.originalPath || "",
        new_path: change.newPath || change.originalPath || "",
        original_value: change.originalValue,
        new_value: change.newValue,
        description: change.description || "",
        timestamp: new Date().toISOString(),
      }))

      await supabase.from("changes").insert(changeRecords)
    }

    return version.id
  }

  static async getVersionHistory(): Promise<Version[]> {
    const { data, error } = await supabase.from("versions").select("*").order("version", { ascending: false })

    if (error) throw error
    return data || []
  }

  static async rollbackToVersion(versionId: string): Promise<void> {
    const { data: version, error: versionError } = await supabase
      .from("versions")
      .select("*")
      .eq("id", versionId)
      .single()

    if (versionError || !version) {
      throw new Error("Version not found")
    }

    await this.createVersion(
      `Rollback to version ${version.version}`,
      `Rolled back to version ${version.version}: ${version.title}`,
      []
    )
  }

  static async compareVersions(version1: string, version2: string): Promise<Change[]> {
    const [v1Data, v2Data] = await Promise.all([this.getVersionData(version1), this.getVersionData(version2)])

    return this.calculateDiff(v1Data, v2Data)
  }

  private static async getVersionData(versionId: string): Promise<any> {
    const { data } = await supabase.from("versions").select("data").eq("id", versionId).single()

    return data?.data || null
  }

  private static calculateDiff(data1: any, data2: any): Change[] {
    const changes: Change[] = []

    if (!data1 || !data2) return changes

    Object.keys(data2).forEach((key) => {
      if (data1[key] !== data2[key]) {
        changes.push({
          id: crypto.randomUUID(),
          version_id: "",
          type: "modified",
          originalPath: key,
          newPath: key,
          originalValue: data1[key],
          newValue: data2[key],
          timestamp: new Date(),
        })
      }
    })

    return changes
  }
}

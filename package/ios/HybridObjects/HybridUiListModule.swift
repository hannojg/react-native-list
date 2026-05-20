//
//  HybridUiListModule.swift
//  ReactNativeList
//
//  Created by Hanno Gödecke on 14.02.26.
//

import Foundation
import NitroModules

class HybridUiListModule : HybridUiListModuleSpec {
    func iosGetWorkletsModule() throws -> any HybridIOSWorkletsModuleProxyHolderSpec {
        do {
            let holderBox = try TurboModuleInstaller.createWorkletsModuleProxyHolder()
            return HybridIOSWorkletsModuleProxyHolder(holderBox: holderBox)
        } catch {
            throw RuntimeError.error(withMessage: String(describing: error))
        }
    }

    func setupRuntime(workletsModuleHolder: Variant_NullType__any_HybridIOSWorkletsModuleProxyHolderSpec_?) throws {
        if (!Thread.isMainThread) {
            throw RuntimeError.error(withMessage: "setupRuntime() must be called from UI thread!")
        }

        guard let workletsModuleHolder else {
            throw RuntimeError.error(withMessage: "setupRuntime() requires IOSWorkletsModuleProxyHolder on iOS.")
        }

        let holder: HybridIOSWorkletsModuleProxyHolder
        switch workletsModuleHolder {
        case .first:
            throw RuntimeError.error(withMessage: "setupRuntime() received null holder on iOS.")
        case .second(let anyHolder):
            guard let concreteHolder = anyHolder as? HybridIOSWorkletsModuleProxyHolder else {
                throw RuntimeError.error(withMessage: "setupRuntime() received unexpected holder type.")
            }
            holder = concreteHolder
        }

        do {
            _ = try TurboModuleInstaller.installNativeModuleProxyInUIRuntime(withHolder: holder.holderBox)
            _ = try TurboModuleInstaller.setupEventInterceptor()
        } catch {
            let message = String(describing: error)
            throw RuntimeError.error(withMessage: message)
        }
    }
}
